import { executeCatalogTool } from "./catalog-tools.mjs";
import { enrichProduct } from "./product-links.mjs";
import { researchSingleProduct, researchCompareProducts } from "./services/productResearchService.mjs";
import { fetchGoogleTrendsNormalized } from "./services/googleTrendsService.mjs";

export const MINING_TOOL_NAMES = new Set([
  "pesquisar_tendencia_google",
  "analisar_potencial_produto",
  "comparar_potencial_produtos",
]);

export const MINING_TOOLS = [
  {
    type: "function",
    function: {
      name: "pesquisar_tendencia_google",
      description:
        "Google Trends (pytrends via CLI): interesse ao longo do tempo, queries relacionadas e rising. Usa para tendência, país (geo) e comparação de keywords.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Termo ou nicho" },
          geo: {
            type: "string",
            description: "Código ISO (ex: PT, ES, FR, US). Default PT",
          },
          timeframe: {
            type: "string",
            description: "Ex: today 3-m, today 12-m. Default today 3-m",
          },
          compare: {
            type: "string",
            description: "Segundo keyword para comparação opcional",
          },
        },
        required: ["keyword"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analisar_potencial_produto",
      description:
        "Analisa UM produto do catálogo: tendência Google, sinais externos (adapters mock), score 0–100, riscos, preço sugerido, recomendação TESTAR/ESCALAR/EVITAR.",
      parameters: {
        type: "object",
        properties: {
          fonte: { type: "string", enum: ["dropipro", "dropi", "ecomhub"] },
          id: { type: "string" },
          geo: { type: "string", description: "Default PT" },
        },
        required: ["fonte", "id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "comparar_potencial_produtos",
      description:
        "Compara 2 a 4 produtos do catálogo (tendência + score) para teste ou escala.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                fonte: { type: "string", enum: ["dropipro", "dropi", "ecomhub"] },
                id: { type: "string" },
              },
              required: ["fonte", "id"],
            },
            minItems: 2,
            maxItems: 4,
          },
          geo: { type: "string" },
        },
        required: ["items"],
        additionalProperties: false,
      },
    },
  },
];

/**
 * @param {string} name
 * @param {Record<string, unknown>} args
 * @param {import("./catalog.mjs").any} catalog
 */
export async function executeMiningTool(name, args, catalog) {
  switch (name) {
    case "pesquisar_tendencia_google": {
      const keyword = String(args.keyword || "").trim();
      const geo = args.geo ? String(args.geo) : "PT";
      const timeframe = args.timeframe ? String(args.timeframe) : "today 3-m";
      const compare = args.compare ? String(args.compare).trim() : "";
      return fetchGoogleTrendsNormalized({
        keyword,
        geo,
        timeframe,
        compare: compare || undefined,
      });
    }

    case "analisar_potencial_produto": {
      return researchSingleProduct(catalog, {
        fonte: String(args.fonte),
        id: String(args.id),
        geo: args.geo ? String(args.geo) : "PT",
      });
    }

    case "comparar_potencial_produtos": {
      return researchCompareProducts(catalog, {
        items: Array.isArray(args.items) ? args.items : [],
        geo: args.geo ? String(args.geo) : "PT",
      });
    }

    default:
      return { erro: `Ferramenta de mineração desconhecida: ${name}` };
  }
}

/**
 * @param {string} name
 * @param {Record<string, unknown>} result
 * @param {import("./catalog.mjs").any} catalog
 */
export function collectMiningProducts(name, result, catalog) {
  const out = [];
  const add = (fonte, id) => {
    const p = executeCatalogTool("obter_produto", { fonte, id }, catalog);
    if (p && !p.erro) out.push(enrichProduct(p));
  };

  if (!result || result.erro) return out;

  if (name === "analisar_potencial_produto" && result.produto?.id) {
    add(result.produto.fonte, result.produto.id);
  }

  if (name === "comparar_potencial_produtos" && Array.isArray(result.comparacao)) {
    for (const row of result.comparacao) {
      const pr = row?.produto;
      if (pr?.fonte && pr?.id) add(pr.fonte, pr.id);
    }
  }

  return out;
}
