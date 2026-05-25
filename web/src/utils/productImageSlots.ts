import type { CampaignPromptCard } from "./parseCampaignPrompts";

/** Quantidade fixa de criativos (2 verticais + 2 quadrados). */
export const PRODUCT_IMAGE_COUNT = 4;

const SACRED =
  "Use EXACTLY the product from the reference image. Do not redesign, recolor, add/remove parts, or invent features. Match geometry, colors, and materials.";

type SlotDef = {
  id: string;
  format: "vertical" | "square";
  title: string;
  scene: string;
  size: string;
};

/** 4 criativos premium — menos tempo, mais consistência. */
const SLOTS: SlotDef[] = [
  {
    id: "V01",
    format: "vertical",
    title: "Hero vertical",
    scene:
      "Hero product shot, product centered and dominant, luxury white studio, soft gradient, minimal empty space top for headline, catalog-quality.",
    size: "1080x1920",
  },
  {
    id: "V02",
    format: "vertical",
    title: "Lifestyle",
    scene:
      "Premium lifestyle in real environment, aspirational mood, product in authentic use, natural light, clean composition.",
    size: "1080x1920",
  },
  {
    id: "Q01",
    format: "square",
    title: "Hero feed",
    scene:
      "Square hero for social feed, product sharp focus, balanced composition, white or soft gray premium background.",
    size: "1080x1080",
  },
  {
    id: "Q02",
    format: "square",
    title: "Benefício",
    scene:
      "Single main benefit from product description, product at 3/4 angle, studio light, space for one short Spanish line.",
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
    "STYLE: Ultra photorealistic premium ecommerce commercial, DJI Apple tech aesthetic.",
    `SCENE: ${slot.scene}`,
    `PRODUCT: "${productTitle}".`,
    productDescription
      ? `CONTEXT: ${productDescription.slice(0, 900)}`
      : "",
    "LIGHT: Professional cinematic studio lighting, real reflections, no harsh artifacts.",
    "COMPOSITION: Mobile-first ad, clean layout, minimal on-image text in Spanish if any.",
    `SIZE: ${slot.size}, photorealistic commercial.`,
    `RESTRICTIONS: ${SACRED}`,
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
