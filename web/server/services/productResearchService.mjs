import { executeCatalogTool } from "../catalog-tools.mjs";
import { fetchGoogleTrendsNormalized } from "./googleTrendsService.mjs";
import { computeProductResearchScore } from "./productScoringService.mjs";
import { gatherExternalSignals } from "../adapters/externalDataAdapters.mjs";

const KW_STOP = new Set([
  "com",
  "sem",
  "para",
  "por",
  "uma",
  "uns",
  "kit",
  "set",
  "pack",
  "unidade",
  "unidades",
  "pcs",
  "pc",
]);

/**
 * Extrai termo curto para Google Trends a partir do nome do produto.
 * @param {string} nome
 */
export function keywordFromProductName(nome) {
  const raw = String(nome || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");

  const parts = raw
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !KW_STOP.has(w));

  const slice = parts.slice(0, 5);
  const kw = slice.join(" ").trim();
  return kw.length >= 3 ? kw : parts[0] || "produto";
}

/**
 * Pesquisa completa: produto + trends + adapters + score.
 * @param {object} catalog
 * @param {{ fonte: string; id: string; geo?: string }} opts
 */
export async function researchSingleProduct(catalog, opts) {
  const fonte = opts.fonte;
  const id = String(opts.id);
  const geo = opts.geo || "PT";

  const prod = executeCatalogTool("obter_produto", { fonte, id }, catalog);
  if (prod?.erro) {
    return { erro: prod.erro, fonte, id };
  }

  const keyword = keywordFromProductName(prod.nome);
  const [trends, external] = await Promise.all([
    fetchGoogleTrendsNormalized({ keyword, geo, timeframe: "today 3-m" }),
    gatherExternalSignals(keyword),
  ]);

  const scoreBundle = computeProductResearchScore({
    product: prod,
    trends,
    external,
  });

  return {
    produto: prod,
    keywordTrend: keyword,
    geo,
    trends,
    externalSignals: external,
    score: scoreBundle,
  };
}

/**
 * @param {object} catalog
 * @param {{ items: { fonte: string; id: string }[]; geo?: string }} opts
 */
export async function researchCompareProducts(catalog, opts) {
  const items = Array.isArray(opts.items) ? opts.items.slice(0, 4) : [];
  if (items.length < 2) {
    return { erro: "Envia items: [{ fonte, id }, ...] com pelo menos 2 produtos." };
  }
  const geo = opts.geo || "PT";
  const out = [];
  for (const it of items) {
    // eslint-disable-next-line no-await-in-loop
    const r = await researchSingleProduct(catalog, {
      fonte: it.fonte,
      id: it.id,
      geo,
    });
    out.push(r);
  }
  return {
    comparacao: out.map((x, i) => ({
      indice: i + 1,
      produto: x.produto,
      keywordTrend: x.keywordTrend,
      score: x.score,
      trendsOk: Boolean(x.trends?.ok),
    })),
    nota: "Compara tendência + score heurístico; confirma sempre com criativos e teste de tráfego.",
  };
}
