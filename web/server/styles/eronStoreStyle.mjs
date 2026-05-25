import { toFile } from "openai";

/** Inline para Vercel (evita readFileSync com path que falha no serverless). */
const DEFAULT_CONFIG = {
  storeName: "ERONO STORE",
  productPageUrl:
    "https://www.eronostore.es/products/smartwatch-ultra-pro-con-2-correas-incluidas-caja-y-cargador-por-induccion-premium-regalo-exclusivo",
  referenceImageUrl:
    "https://cdn.shopify.com/s/files/1/0935/1833/2281/files/ChatGPT_Image_5_de_fev._de_2026_20_34_24.png?v=1770323727",
  promptBlock:
    "VISUAL STYLE — ERONO STORE (Spanish high-conversion COD ecommerce, same level as eronostore.es product pages): Pure white background #FFFFFF or ultra-soft warm gray gradient. Product is the hero, centered, 70–90% of frame, crisp commercial edges, soft realistic contact shadow under product (no floating). High-key studio lighting, subtle reflections, premium gadget/watch aesthetic. Clean, minimal, NO clutter, NO watermark, NO cheap collage. Photorealistic catalog + Meta Ads ready. Trust/offer vibe: premium gift pack, España, aspirational middle class. On-image text only if needed: short Spanish, bold sans-serif, high contrast. Avoid dark moody backgrounds, avoid cartoon, avoid distorted logos.",
};

export function getEronoStyleConfig() {
  return {
    ...DEFAULT_CONFIG,
    referenceImageUrl:
      process.env.ERONO_STYLE_REFERENCE_IMAGE_URL?.trim() ||
      DEFAULT_CONFIG.referenceImageUrl,
    productPageUrl:
      process.env.ERONO_STYLE_PAGE_URL?.trim() ||
      DEFAULT_CONFIG.productPageUrl,
  };
}

export function getEronoStylePromptBlock() {
  const extra = process.env.ERONO_STYLE_EXTRA_PROMPT?.trim();
  const block = getEronoStyleConfig().promptBlock;
  return extra ? `${block}\n${extra}` : block;
}

let cachedStyleFile = null;

/** Imagem de referência da loja (fotografia de conversão). */
export async function loadEronoStyleReferenceFile() {
  if (cachedStyleFile) return cachedStyleFile;

  const url = getEronoStyleConfig().referenceImageUrl;
  const res = await fetch(url, {
    headers: { "User-Agent": "api-produtos/1.0" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(
      `Não foi possível carregar referência ERONO (${res.status}).`
    );
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  cachedStyleFile = await toFile(buffer, "eron-style-ref.png", {
    type: "image/png",
  });
  return cachedStyleFile;
}
