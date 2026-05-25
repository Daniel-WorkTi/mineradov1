import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { toFile } from "openai";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {{ storeName: string; productPageUrl: string; referenceImageUrl: string; promptBlock: string }} */
let cachedConfig = null;

function loadConfig() {
  if (cachedConfig) return cachedConfig;
  const path = join(__dirname, "../../shared/eron-visual-style.json");
  cachedConfig = JSON.parse(readFileSync(path, "utf8"));
  return cachedConfig;
}

export function getEronoStyleConfig() {
  const cfg = loadConfig();
  return {
    ...cfg,
    referenceImageUrl:
      process.env.ERONO_STYLE_REFERENCE_IMAGE_URL?.trim() ||
      cfg.referenceImageUrl,
    productPageUrl:
      process.env.ERONO_STYLE_PAGE_URL?.trim() || cfg.productPageUrl,
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
    throw new Error(`Não foi possível carregar referência ERONO (${res.status}).`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  cachedStyleFile = await toFile(buffer, "eron-style-ref.png", {
    type: "image/png",
  });
  return cachedStyleFile;
}
