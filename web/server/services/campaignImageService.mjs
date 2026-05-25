import OpenAI, { toFile } from "openai";
import {
  formatOpenAIError,
  getOpenAIApiKey,
  openAIKeyErrorMessage,
} from "../openai-env.mjs";

/** Modelo GPT Image nativo (mesmo ecossistema do ChatGPT). */
export const CAMPAIGN_IMAGE_MODEL =
  process.env.CAMPAIGN_IMAGE_MODEL || "gpt-image-1";

const GPT_RESPONSE_MODEL =
  process.env.CAMPAIGN_GPT_MODEL ||
  process.env.OPENAI_MODEL ||
  "gpt-4o";

const MAX_PROMPT_CHARS = 3500;

function isGptImageModel(model) {
  return String(model).startsWith("gpt-image");
}

function resolveImageQuality(model) {
  const q = (process.env.CAMPAIGN_IMAGE_QUALITY || "high").toLowerCase();
  if (isGptImageModel(model)) {
    if (["low", "medium", "high", "auto"].includes(q)) return q;
    return "high";
  }
  return q === "hd" ? "hd" : "standard";
}

function resolveSize(format, model) {
  const vertical = format === "vertical";
  if (isGptImageModel(model)) {
    return vertical ? "1024x1536" : "1024x1024";
  }
  return vertical ? "1024x1792" : "1024x1024";
}

/**
 * @param {{ cardBody: string; productTitle?: string; productDescription?: string; format?: string; withReference?: boolean }} input
 */
export function buildImageGenerationPrompt(input) {
  const title = input.productTitle?.trim() || "product";
  const desc = input.productDescription?.trim().slice(0, 800) || "";
  const scene = (input.cardBody || "").trim().slice(0, MAX_PROMPT_CHARS);
  const layout =
    input.format === "vertical"
      ? "Vertical 9:16 mobile ad, portrait composition."
      : "Square 1:1 feed ad composition.";

  const refNote = input.withReference
    ? "Use the EXACT product from the reference photo — same design, colors, shape, proportions. Do not redesign the product."
    : "Keep the product design, colors and proportions accurate.";

  return [
    "Ultra photorealistic premium ecommerce commercial, DJI Apple tech aesthetic.",
    `Product: "${title}".`,
    desc ? `Context: ${desc}` : "",
    refNote,
    "Professional cinematic lighting, luxury minimal background.",
    "No watermark, no distorted text.",
    layout,
    "Creative brief:",
    scene,
  ]
    .filter(Boolean)
    .join("\n");
}

function dataUrlToBuffer(dataUrl) {
  const m = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error("Imagem de referência inválida.");
  return { mime: m[1], buffer: Buffer.from(m[2], "base64") };
}

async function referenceFileFromDataUrl(dataUrl) {
  const { mime, buffer } = dataUrlToBuffer(dataUrl);
  const ext = mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : "png";
  return toFile(buffer, `product.${ext}`, { type: mime });
}

function extractImageFromResponse(response) {
  for (const output of response.output || []) {
    if (output.type === "image_generation_call" && output.result) {
      return output.result;
    }
  }
  return null;
}

/**
 * Gera via Responses API — GPT + tool image_generation (com referência visual).
 */
async function generateViaGptResponses(openai, params) {
  const prompt = buildImageGenerationPrompt({
    cardBody: params.prompt,
    productTitle: params.productTitle,
    productDescription: params.productDescription,
    format: params.format,
    withReference: Boolean(params.productImageDataUrl),
  });

  const size = resolveSize(params.format, CAMPAIGN_IMAGE_MODEL);
  const quality = resolveImageQuality(CAMPAIGN_IMAGE_MODEL);

  /** @type {import("openai/resources/responses/responses").ResponseInputMessageContentList} */
  const content = [{ type: "input_text", text: prompt }];
  if (params.productImageDataUrl) {
    content.push({
      type: "input_image",
      image_url: params.productImageDataUrl,
      detail: "high",
    });
  }

  const response = await openai.responses.create({
    model: GPT_RESPONSE_MODEL,
    input: [{ role: "user", content }],
    tool_choice: { type: "image_generation" },
    tools: [
      {
        type: "image_generation",
        model: isGptImageModel(CAMPAIGN_IMAGE_MODEL)
          ? CAMPAIGN_IMAGE_MODEL
          : "gpt-image-1",
        size,
        quality,
        input_fidelity: params.productImageDataUrl ? "high" : "low",
      },
    ],
  });

  const b64 = extractImageFromResponse(response);
  if (!b64) {
    throw new Error("GPT não devolveu imagem (Responses API).");
  }

  return {
    imageDataUrl: `data:image/png;base64,${b64}`,
    model: GPT_RESPONSE_MODEL,
    method: "gpt-responses",
    size,
    revisedPrompt: null,
  };
}

/**
 * GPT Image — edit com foto de referência do produto.
 */
async function generateViaGptImageEdit(openai, params) {
  const model = CAMPAIGN_IMAGE_MODEL;
  const prompt = buildImageGenerationPrompt({
    cardBody: params.prompt,
    productTitle: params.productTitle,
    productDescription: params.productDescription,
    format: params.format,
    withReference: true,
  });
  const size = resolveSize(params.format, model);
  const quality = resolveImageQuality(model);
  const imageFile = await referenceFileFromDataUrl(params.productImageDataUrl);

  const response = await openai.images.edit({
    model,
    image: imageFile,
    prompt,
    n: 1,
    size,
    quality,
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error("GPT Image edit não devolveu imagem.");

  return {
    imageDataUrl: `data:image/png;base64,${b64}`,
    model,
    method: "gpt-image-edit",
    size,
    revisedPrompt: null,
  };
}

/**
 * GPT Image — geração pura (sem referência).
 */
async function generateViaGptImageGenerate(openai, params) {
  const model = CAMPAIGN_IMAGE_MODEL;
  const prompt = buildImageGenerationPrompt({
    cardBody: params.prompt,
    productTitle: params.productTitle,
    productDescription: params.productDescription,
    format: params.format,
    withReference: false,
  });
  const size = resolveSize(params.format, model);
  const quality = resolveImageQuality(model);

  /** @type {Record<string, unknown>} */
  const body = {
    model,
    prompt,
    n: 1,
    size,
    quality,
  };

  if (!isGptImageModel(model)) {
    body.response_format = "b64_json";
  }

  const response = await openai.images.generate(body);

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error("GPT Image generate não devolveu imagem.");

  return {
    imageDataUrl: `data:image/png;base64,${b64}`,
    model,
    method: "gpt-image-generate",
    size,
    revisedPrompt: response.data?.[0]?.revised_prompt || null,
  };
}

/**
 * @param {{
 *   prompt: string;
 *   format?: string;
 *   productTitle?: string;
 *   productDescription?: string;
 *   productImageDataUrl?: string;
 * }} params
 */
function throwIfAuthError(err) {
  const msg = formatOpenAIError(err);
  if (/401|Chave OpenAI rejeitada/i.test(msg)) {
    throw new Error(msg);
  }
}

export async function generateCampaignImage(params) {
  const keyStatus = getOpenAIApiKey();
  const keyMsg = openAIKeyErrorMessage(keyStatus);
  if (keyMsg) throw new Error(keyMsg);

  const openai = new OpenAI({ apiKey: keyStatus.key });
  const format = params.format === "vertical" ? "vertical" : "square";
  const normalized = {
    prompt: params.prompt,
    format,
    productTitle: params.productTitle,
    productDescription: params.productDescription,
    productImageDataUrl: params.productImageDataUrl?.trim() || null,
  };

  const errors = [];

  // 1) GPT Image edit — foto de referência (melhor fidelidade ao produto)
  if (normalized.productImageDataUrl) {
    try {
      return await generateViaGptImageEdit(openai, normalized);
    } catch (e) {
      throwIfAuthError(e);
      errors.push(formatOpenAIError(e));
    }
  }

  // 2) GPT Image generate (sem referência)
  try {
    return await generateViaGptImageGenerate(openai, normalized);
  } catch (e) {
    throwIfAuthError(e);
    errors.push(formatOpenAIError(e));
  }

  // 3) Fallback: Responses API
  try {
    return await generateViaGptResponses(openai, normalized);
  } catch (e) {
    throwIfAuthError(e);
    errors.push(formatOpenAIError(e));
    throw new Error(
      errors.length === 1
        ? errors[0]
        : `Falha ao gerar imagem: ${errors.join(" | ")}`
    );
  }
}
