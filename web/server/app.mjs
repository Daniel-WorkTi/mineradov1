import cors from "cors";
import express from "express";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { loadCatalog, reloadCatalog } from "./catalog.mjs";
import {
  ALL_CHAT_TOOLS,
  collectAllToolProducts,
  executeChatTool,
} from "./all-tools.mjs";
import { buildCatalogOverview, resolveChatProducts } from "./catalog-tools.mjs";
import { loadProductMiningPrompt } from "./agents/ProductMiningAgent.mjs";
import {
  buildCampaignChatMessages,
  loadCampaignCreativePrompt,
} from "./agents/CampaignCreativeAgent.mjs";
import { resolveChatAgent, CHAT_AGENT_LIST } from "./chat-agents.mjs";
import { researchSingleProduct } from "./services/productResearchService.mjs";
import { CHAT_MAX_PRODUCTS, getChatProductLimit } from "./chat-constants.mjs";
import { loadWebEnv } from "./load-env.mjs";
import { getOpenAIApiKey, openAIKeyErrorMessage } from "./openai-env.mjs";
import { saveCampaignBrief, getCampaignBrief } from "./campaignBriefStore.mjs";
import { getCardPrompt } from "./productImageSlots.mjs";
import { generateCampaignImage } from "./services/campaignImageService.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, "..");

loadWebEnv(ROOT);

export const MODEL = process.env.OPENAI_MODEL || "gpt-4o";
const PROMPT_FILE =
  process.env.ECOMHUB_PROMPT_FILE ||
  join(__dirname, "prompts/ecomhub-pro.txt");

const ECOMHUB_PRO_GPT_URL =
  "https://chatgpt.com/g/g-684c8351d31c8191b5f28cda2646937c-ecomhub-pro";

function resolveCatalogDataDir() {
  const candidates = [
    join(ROOT, "public/data"),
    join(process.cwd(), "web/public/data"),
    join(process.cwd(), "public/data"),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, "minerado.json"))) return dir;
  }
  return join(ROOT, "public/data");
}

export const CATALOG_DATA_DIR = resolveCatalogDataDir();

function loadSystemPrompt() {
  if (existsSync(PROMPT_FILE)) {
    return readFileSync(PROMPT_FILE, "utf8").trim();
  }
  return `Tu és o Ecomhub PRO integrado ao minerador de produtos. Responde em português usando só o CONTEXTO.`;
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "4mb" }));

app.use((err, req, res, _next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      error:
        "Pedido demasiado grande (máx. ~4 MB na Vercel). Comprime a foto do produto.",
    });
  }
  console.error("API error:", err);
  if (!res.headersSent) {
    res.status(500).json({
      error: err?.message || "Erro interno no servidor.",
    });
  }
});

let catalog = null;

function ensureCatalog() {
  if (!catalog) {
    catalog = loadCatalog(CATALOG_DATA_DIR);
  }
  return catalog;
}

app.get("/api/health", (_req, res) => {
  const keyStatus = getOpenAIApiKey();
  try {
    ensureCatalog();
    res.json({
      ok: true,
      openai: Boolean(keyStatus.key),
      openai_key_valid: Boolean(keyStatus.key),
      openai_key_error: keyStatus.error,
      openai_key_hint: keyStatus.hint || null,
      model: MODEL,
      persona: "Ecomhub PRO",
      ecomhubGptUrl: ECOMHUB_PRO_GPT_URL,
      produtos: catalog.products.length,
      catalogo_completo: true,
      agents: CHAT_AGENT_LIST.map((a) => ({
        id: a.id,
        label: a.label,
        subtitle: a.subtitle,
        persona: a.persona,
      })),
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message) });
  }
});

app.post("/api/chat", async (req, res) => {
  const keyStatus = getOpenAIApiKey();
  const keyMsg = openAIKeyErrorMessage(keyStatus);
  if (keyMsg) {
    return res.status(503).json({ error: keyMsg });
  }

  const {
    messages = [],
    agent: agentId,
    productImageUrl,
    productImageDataUrl,
    productTitle,
    productDescription,
    campaignLanguage,
  } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Envia messages[]" });
  }

  const agent = resolveChatAgent(agentId);

  try {
    const openai = new OpenAI({ apiKey: keyStatus.key });

    if (agent.id === "campaign") {
      const campaignPrompt = loadCampaignCreativePrompt();
      if (!campaignPrompt) {
        return res.status(500).json({
          error: "Prompt de campanhas não encontrado (campaignCreative.txt).",
        });
      }

      const chatMessages = [
        { role: "system", content: campaignPrompt },
        ...buildCampaignChatMessages(
          messages.slice(-12).map((m) => ({
            role: m.role,
            content: String(m.content ?? ""),
          })),
          {
            productTitle,
            productDescription,
            language: campaignLanguage,
            productImageDataUrl,
            productImageUrl,
          }
        ),
      ];

      const completion = await openai.chat.completions.create({
        model: MODEL,
        temperature: agent.temperature,
        max_tokens: agent.maxTokens,
        messages: chatMessages,
      });

      const reply =
        completion.choices[0]?.message?.content ||
        "Não consegui gerar resposta.";

      return res.json({
        reply,
        model: MODEL,
        agent: agent.id,
        persona: agent.persona,
        products: [],
        products_limit: 0,
        products_max: CHAT_MAX_PRODUCTS,
      });
    }

    const cat = ensureCatalog();
    const overview = buildCatalogOverview(cat);

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const userContext = lastUser?.content || "";
    const productLimit = getChatProductLimit(userContext);

    const systemPrompt = loadSystemPrompt();

    const productModeSystem =
      productLimit > 0
        ? {
            role: "system",
            content: `Pedido actual: o utilizador pediu sugestões com **até ${productLimit}** produto(s) com cards no chat (máximo ${CHAT_MAX_PRODUCTS}). Usa \`pesquisar_catalogo\` com \`limite: ${productLimit}\` antes de listar. Inclui uma lista numerada (1. 2. …) com **até ${productLimit}** nomes exactos do catálogo (como devolve a ferramenta).`,
          }
        : {
            role: "system",
            content: `Pedido actual: o utilizador **não** pediu lista de produtos nem cards nesta mensagem. Responde em texto claro (resumo, explicação, totais). **Não** uses lista numerada de produtos nem frases do tipo "clica nos produtos abaixo". Usa \`estatisticas_catalogo\`, \`listar_oportunidades\` ou \`listar_matches\` quando precisares de dados agregados. Só usa \`pesquisar_catalogo\` com \`limite\` 1–2 se a pergunta for claramente sobre um produto ou SKU concreto; evita devolver vários produtos para perguntas genéricas.`,
          };

    const miningPrompt = agent.useMiningContext
      ? loadProductMiningPrompt()
      : "";
    const miningSystem = miningPrompt
      ? [{ role: "system", content: miningPrompt }]
      : [];

    const chatMessages = [
      { role: "system", content: systemPrompt },
      {
        role: "system",
        content: `CATÁLOGO (resumo + ferramentas para os ${cat.products.length} produtos):\n${overview}`,
      },
      productModeSystem,
      ...miningSystem,
      ...messages.slice(-12).map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    let completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: agent.temperature,
      max_tokens: agent.maxTokens,
      tools: ALL_CHAT_TOOLS,
      tool_choice: "auto",
      messages: chatMessages,
    });

    const mentioned = new Map();
    const addMentioned = (items) => {
      for (const p of items) {
        if (p?.id) mentioned.set(`${p.fonte}:${p.id}`, p);
      }
    };

    let guard = 0;
    while (completion.choices[0]?.message?.tool_calls?.length && guard < 8) {
      guard += 1;
      const assistantMsg = completion.choices[0].message;
      chatMessages.push(assistantMsg);

      for (const call of assistantMsg.tool_calls) {
        let args = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          args = {};
        }
        const result = await executeChatTool(call.function.name, args, cat);
        addMentioned(
          collectAllToolProducts(call.function.name, result, cat)
        );
        chatMessages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }

      completion = await openai.chat.completions.create({
        model: MODEL,
        temperature: agent.temperature,
        max_tokens: agent.maxTokens,
        tools: ALL_CHAT_TOOLS,
        tool_choice: "auto",
        messages: chatMessages,
      });
    }

    const reply =
      completion.choices[0]?.message?.content ||
      "Não consegui gerar resposta.";

    const displayProducts = resolveChatProducts(
      [...mentioned.values()],
      reply,
      userContext,
      cat,
      productLimit
    );

    res.json({
      reply,
      model: MODEL,
      agent: agent.id,
      persona: agent.persona,
      catalogo_produtos: cat.products.length,
      products: displayProducts,
      products_limit: productLimit,
      products_max: CHAT_MAX_PRODUCTS,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message || "Erro ao chamar OpenAI",
    });
  }
});

/** Guarda briefing + foto uma vez (evita enviar a imagem 4× na Vercel). */
app.post("/api/campaign/brief", async (req, res) => {
  const keyMsg = openAIKeyErrorMessage(getOpenAIApiKey());
  if (keyMsg) return res.status(503).json({ error: keyMsg });

  const {
    productTitle,
    productDescription,
    productImageDataUrl,
    extraNote,
  } = req.body || {};

  if (!productImageDataUrl?.trim()) {
    return res.status(400).json({ error: "Envia productImageDataUrl." });
  }
  if (!productTitle?.trim()) {
    return res.status(400).json({ error: "Envia productTitle." });
  }

  const briefId = saveCampaignBrief({
    productImageDataUrl: String(productImageDataUrl),
    productTitle: String(productTitle),
    productDescription: String(productDescription || ""),
    extraNote: extraNote ? String(extraNote) : "",
  });

  res.json({ briefId });
});

/** Gera uma imagem (GPT Image) — usa briefId + cardId (V01, V02, Q01, Q02). */
app.post("/api/campaign/generate-image", async (req, res) => {
  const keyStatus = getOpenAIApiKey();
  const keyMsg = openAIKeyErrorMessage(keyStatus);
  if (keyMsg) {
    return res.status(503).json({ error: keyMsg });
  }

  const { cardId, briefId, prompt, format, productTitle, productDescription, productImageDataUrl } =
    req.body || {};

  if (!cardId) {
    return res.status(400).json({ error: "Envia cardId (V01, V02, Q01, Q02)." });
  }

  let brief = briefId ? getCampaignBrief(briefId) : null;
  let resolvedPrompt = prompt?.trim() ? String(prompt) : "";
  let resolvedFormat = format === "vertical" ? "vertical" : "square";
  let title = productTitle ? String(productTitle) : "";
  let description = productDescription ? String(productDescription) : "";
  let imageUrl = productImageDataUrl ? String(productImageDataUrl) : undefined;

  if (brief) {
    title = brief.productTitle;
    description = brief.productDescription;
    imageUrl = brief.productImageDataUrl;
    const built = getCardPrompt(String(cardId), {
      productTitle: title,
      productDescription: description,
      extraNote: brief.extraNote,
    });
    if (!built) {
      return res.status(400).json({ error: `cardId inválido: ${cardId}` });
    }
    resolvedPrompt = built.prompt;
    resolvedFormat = built.card.format;
  } else if (!resolvedPrompt) {
    return res.status(400).json({
      error: "Envia briefId (recomendado) ou prompt completo.",
    });
  }

  if (!imageUrl) {
    return res.status(400).json({
      error: "Falta imagem do produto. Gera de novo a partir do briefing.",
    });
  }

  try {
    const result = await generateCampaignImage({
      prompt: resolvedPrompt,
      format: resolvedFormat,
      productTitle: title,
      productDescription: description,
      productImageDataUrl: imageUrl,
    });

    res.json({
      cardId: String(cardId),
      imageDataUrl: result.imageDataUrl,
      model: result.model,
      method: result.method,
      size: result.size,
      revisedPrompt: result.revisedPrompt,
    });
  } catch (err) {
    console.error("campaign/generate-image:", err);
    res.status(500).json({
      error: err.message || "Erro ao gerar imagem.",
    });
  }
});

/** Análise estruturada (trends + score + mocks) — útil para integrações sem passar pelo chat. */
app.post("/api/product-mining/analyze", async (req, res) => {
  const { fonte, id, geo } = req.body || {};
  if (!fonte || id == null || id === "") {
    return res.status(400).json({ error: "Envia fonte e id no body JSON." });
  }
  try {
    const cat = ensureCatalog();
    const data = await researchSingleProduct(cat, {
      fonte: String(fonte),
      id: String(id),
      geo: geo ? String(geo) : "PT",
    });
    if (data.erro) return res.status(404).json(data);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});

app.post("/api/reload-catalog", (_req, res) => {
  try {
    catalog = reloadCatalog(CATALOG_DATA_DIR);
    res.json({ ok: true, produtos: catalog.products.length });
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});

export default app;
