import { getEronoStyleConfig, getEronoStylePromptBlock } from "./styles/eronStoreStyle.mjs";

const SACRED =
  "Use EXACTLY the product from the user's reference photo. Do not redesign, recolor, add/remove parts, or invent features. Match geometry, colors, and materials.";

const SLOTS = [
  {
    id: "V01",
    format: "vertical",
    title: "Hero PDP (Erono)",
    scene:
      "Main product gallery hero like eronostore.es: product centered on pure white #FFFFFF, soft contact shadow, 9:16 mobile PDP, space at top for optional short Spanish offer line, ultra sharp product, gift-premium feel.",
    size: "1080x1920",
  },
  {
    id: "V02",
    format: "vertical",
    title: "Lifestyle España",
    scene:
      "Aspirational lifestyle Spain: product in real use, clean modern environment, bright natural light, premium and minimal.",
    size: "1080x1920",
  },
  {
    id: "Q01",
    format: "square",
    title: "Pack / regalo",
    scene:
      "Flat lay pack shot on white: product plus included accessories from description, symmetric neat layout, eronostore.es conversion style.",
    size: "1080x1080",
  },
  {
    id: "Q02",
    format: "square",
    title: "Benefício clave",
    scene:
      "Single key benefit macro or 3/4 hero from description, white studio, one short Spanish benefit text area.",
    size: "1080x1080",
  },
];

function slotBody(slot, productTitle, productDescription, extraNote) {
  const cfg = getEronoStyleConfig();
  const lines = [
    getEronoStylePromptBlock(),
    `SCENE: ${slot.scene}`,
    `PRODUCT: "${productTitle}".`,
    productDescription ? `CONTEXT: ${productDescription.slice(0, 900)}` : "",
    "LIGHT: High-key studio, soft shadow, real reflections, Spain COD ecommerce polish.",
    `SIZE: ${slot.size}, photorealistic commercial.`,
    `RESTRICTIONS: ${SACRED}`,
    `STYLE REFERENCE PAGE: ${cfg.productPageUrl}`,
  ];
  if (extraNote?.trim()) lines.push(`EXTRA: ${extraNote.trim().slice(0, 400)}`);
  return lines.filter(Boolean).join("\n");
}

export function buildProductImageCards(input) {
  const title = (input.productTitle || "").trim() || "Product";
  const desc = (input.productDescription || "").trim();
  return SLOTS.map((slot) => ({
    id: slot.id,
    format: slot.format,
    title: slot.title,
    body: slotBody(slot, title, desc, input.extraNote),
  }));
}

export function fullPromptText(card) {
  return `${card.id} — ${card.title}\n\n${card.body}`.trim();
}

export function getCardPrompt(cardId, brief) {
  const cards = buildProductImageCards(brief);
  const card = cards.find((c) => c.id === cardId);
  if (!card) return null;
  return { card, prompt: fullPromptText(card) };
}
