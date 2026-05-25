import type { CampaignPromptCard } from "./parseCampaignPrompts";
import { ERONO_STYLE_PROMPT, ERONO_STORE } from "./eronStoreStyle";

/** Quantidade fixa de criativos (2 verticais + 2 quadrados). */
export const PRODUCT_IMAGE_COUNT = 4;

const SACRED =
  "Use EXACTLY the product from the user's reference photo. Do not redesign, recolor, add/remove parts, or invent features. Match geometry, colors, and materials.";

type SlotDef = {
  id: string;
  format: "vertical" | "square";
  title: string;
  scene: string;
  size: string;
};

/** 4 criativos estilo ERONO STORE — conversão ES, fundo branco premium. */
const SLOTS: SlotDef[] = [
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
      "Aspirational lifestyle Spain: product in real use (wrist for watch, or natural use for the product type), clean modern environment, bright natural light, still premium and minimal, not cluttered.",
    size: "1080x1920",
  },
  {
    id: "Q01",
    format: "square",
    title: "Pack / regalo",
    scene:
      "Flat lay pack shot on white: product plus included accessories from description (straps, box, charger, extras), symmetric neat layout, ecommerce bundle visual, eronostore.es conversion style.",
    size: "1080x1080",
  },
  {
    id: "Q02",
    format: "square",
    title: "Benefício clave",
    scene:
      "Single key benefit macro or 3/4 hero: highlight main feature from description (health, battery, charging, etc.), white studio, one short Spanish benefit text area, trust and clarity.",
    size: "1080x1080",
  },
];

function slotBody(
  slot: SlotDef,
  productTitle: string,
  productDescription: string,
  extraNote?: string
): string {
  const lines = [
    ERONO_STYLE_PROMPT,
    `SCENE: ${slot.scene}`,
    `PRODUCT: "${productTitle}".`,
    productDescription
      ? `CONTEXT: ${productDescription.slice(0, 900)}`
      : "",
    "LIGHT: High-key studio, soft shadow, real reflections, Spain COD ecommerce polish.",
    `SIZE: ${slot.size}, photorealistic commercial.`,
    `RESTRICTIONS: ${SACRED}`,
    `STYLE REFERENCE PAGE: ${ERONO_STORE.productPageUrl}`,
  ];
  if (extraNote?.trim()) {
    lines.push(`EXTRA: ${extraNote.trim().slice(0, 400)}`);
  }
  return lines.filter(Boolean).join("\n");
}

export function buildProductImageCards(input: {
  productTitle: string;
  productDescription: string;
  extraNote?: string;
}): CampaignPromptCard[] {
  const title = input.productTitle.trim() || "Product";
  const desc = input.productDescription.trim();

  return SLOTS.map((slot) => ({
    id: slot.id,
    format: slot.format,
    title: slot.title,
    body: slotBody(slot, title, desc, input.extraNote),
  }));
}
