import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Prompt do agente de campanhas visuais premium (DJI / Apple). */
export function loadCampaignCreativePrompt() {
  const p = join(__dirname, "..", "prompts", "campaignCreative.txt");
  if (!existsSync(p)) return "";
  return readFileSync(p, "utf8").trim();
}

/**
 * @param {string} [dataUrl]
 * @returns {string|null}
 */
export function normalizeProductImageDataUrl(dataUrl) {
  const s = dataUrl?.trim();
  if (!s) return null;
  if (s.startsWith("data:image/")) return s;
  return null;
}

/**
 * @param {{ productTitle?: string; productDescription?: string; language?: string }} ctx
 */
export function buildCampaignProductContext(ctx) {
  const title = ctx.productTitle?.trim() || "";
  const description = ctx.productDescription?.trim() || "";
  const language = ctx.language?.trim() || "espanhol (ES)";
  if (!title && !description) return "";

  return [
    "## CONTEXTO DO PRODUTO (briefing do utilizador — prioridade máxima)",
    title ? `**Título:** ${title}` : "",
    description ? `**Descrição e especificações:**\n${description}` : "",
    `**Idioma das copys nos criativos:** ${language}`,
    "",
    "Usa este contexto + a imagem de referência para todos os prompts. Não peças URL da loja nem ficheiros externos.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * @param {Array<{ role: string; content: string }>} messages
 * @param {{ productImageDataUrl?: string; productImageUrl?: string }} media
 */
export function attachProductImageToLastUserMessage(messages, media) {
  const dataUrl = normalizeProductImageDataUrl(media.productImageDataUrl);
  const httpUrl = media.productImageUrl?.trim();
  const imageUrl = dataUrl || (httpUrl?.startsWith("http") ? httpUrl : null);

  if (!imageUrl || messages.length === 0) return messages;

  const lastIdx = messages.length - 1;
  const last = messages[lastIdx];
  if (last.role !== "user") return messages;

  const text =
    typeof last.content === "string"
      ? last.content
      : "Genera la campaña según el briefing.";

  return [
    ...messages.slice(0, lastIdx),
    {
      role: "user",
      content: [
        { type: "text", text },
        {
          type: "image_url",
          image_url: { url: imageUrl, detail: "high" },
        },
      ],
    },
  ];
}

/**
 * @param {Array<{ role: string; content: string }>} messages
 * @param {{
 *   productTitle?: string;
 *   productDescription?: string;
 *   language?: string;
 *   productImageDataUrl?: string;
 *   productImageUrl?: string;
 * }} options
 */
export function buildCampaignChatMessages(messages, options = {}) {
  const mapped = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const productContext = buildCampaignProductContext(options);
  const withContext = productContext
    ? [{ role: "system", content: productContext }, ...mapped]
    : mapped;

  return attachProductImageToLastUserMessage(withContext, options);
}
