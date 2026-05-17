import cors from "cors";
import express from "express";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { loadCatalog, reloadCatalog } from "./catalog.mjs";
import {
  buildCatalogOverview,
  CATALOG_TOOLS,
  collectProductsFromToolResult,
  executeCatalogTool,
  resolveChatProducts,
} from "./catalog-tools.mjs";
import { CHAT_MAX_PRODUCTS, getChatProductLimit } from "./chat-constants.mjs";
import { loadWebEnv } from "./load-env.mjs";
import { getOpenAIApiKey } from "./openai-env.mjs";

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
app.use(express.json({ limit: "2mb" }));

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
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message) });
  }
});

app.post("/api/chat", async (req, res) => {
  const keyStatus = getOpenAIApiKey();
  if (!keyStatus.key) {
    const msg =
      keyStatus.error === "invalid_format"
        ? `OPENAI_API_KEY inválida. ${keyStatus.hint} Na Vercel: Settings → Environment Variables → edita OPENAI_API_KEY (valor completo, começa por sk-) e faz Redeploy.`
        : "OPENAI_API_KEY não configurada. Na Vercel: Environment Variables; local: web/.env ou web/.env.example.";
    return res.status(503).json({ error: msg });
  }

  const { messages = [] } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Envia messages[]" });
  }

  try {
    const cat = ensureCatalog();
    const overview = buildCatalogOverview(cat);

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const userContext = lastUser?.content || "";
    const productLimit = getChatProductLimit(userContext);

    const openai = new OpenAI({ apiKey: keyStatus.key });
    const systemPrompt = loadSystemPrompt();

    const chatMessages = [
      { role: "system", content: systemPrompt },
      {
        role: "system",
        content: `CATÁLOGO (resumo + ferramentas para os ${cat.products.length} produtos):\n${overview}`,
      },
      {
        role: "system",
        content: `Pedido actual: o utilizador quer **${productLimit} produto(s)** com cards clicáveis no chat (máximo ${CHAT_MAX_PRODUCTS}). Na resposta, lista numerada com **exactamente ${productLimit}** produtos distintos. Chama \`pesquisar_catalogo\` com \`limite: ${productLimit}\` (e consulta alinhada ao nicho/pedido).`,
      },
      ...messages.slice(-12).map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    let completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.35,
      max_tokens: 1600,
      tools: CATALOG_TOOLS,
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
        const result = executeCatalogTool(call.function.name, args, cat);
        addMentioned(
          collectProductsFromToolResult(call.function.name, result, cat)
        );
        chatMessages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }

      completion = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.35,
        max_tokens: 1600,
        tools: CATALOG_TOOLS,
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
      persona: "Ecomhub PRO",
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

app.post("/api/reload-catalog", (_req, res) => {
  try {
    catalog = reloadCatalog(CATALOG_DATA_DIR);
    res.json({ ok: true, produtos: catalog.products.length });
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});

export default app;
