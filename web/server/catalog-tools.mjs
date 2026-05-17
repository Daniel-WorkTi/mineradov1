import { searchProducts } from "./catalog.mjs";
import { CHAT_MAX_PRODUCTS } from "./chat-constants.mjs";
import { enrichProduct, buildProductUrl } from "./product-links.mjs";

function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2);
}

function normalizeText(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const STOPWORDS = new Set([
  "para",
  "com",
  "sem",
  "uma",
  "uns",
  "por",
  "que",
  "dos",
  "das",
  "produto",
  "produtos",
  "dropi",
  "dropipro",
  "ecomhub",
  "stock",
  "preco",
  "euro",
  "eur",
]);

function matchProductsInNormalized(normalized, catalog, max) {
  const scored = [];

  for (const p of catalog.products) {
    const name = (p.nome || "").trim();
    if (name.length < 4) continue;

    const nameNorm = normalizeText(name);
    let score = 0;

    if (normalized.includes(nameNorm)) {
      score = 100 + nameNorm.length;
    } else {
      const words = nameNorm.split(/\s+/).filter((w) => w.length >= 4 && !STOPWORDS.has(w));
      if (words.length === 0) continue;
      let hits = 0;
      for (const w of words) {
        if (normalized.includes(w)) hits += 1;
      }
      const need = words.length <= 2 ? words.length : Math.max(2, Math.ceil(words.length * 0.6));
      if (hits >= need) score = hits * 15 + words.length;
    }

    if (score > 0) scored.push({ p, score });
  }

  scored.sort((a, b) => b.score - a.score);

  const seen = new Set();
  const out = [];
  for (const { p } of scored) {
    const key = `${p.fonte}:${p.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(enrichProduct(p));
    if (out.length >= max) break;
  }
  return out;
}

/** Produtos cujo nome aparece na resposta (upsell, recomendações, etc.). */
export function extractProductsMentionedInText(text, catalog, max = CHAT_MAX_PRODUCTS) {
  if (!text?.trim()) return [];

  const numberedLines = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*\d+[.)]\s+(.+)/);
    if (m) numberedLines.push(m[1].replace(/\*\*/g, ""));
  }

  if (numberedLines.length > 0) {
    const fromList = [];
    const seen = new Set();
    for (const line of numberedLines) {
      const hits = matchProductsInNormalized(normalizeText(line), catalog, 5);
      const best = hits[0];
      if (!best) continue;
      const key = `${best.fonte}:${best.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        fromList.push(best);
      }
    }
    if (fromList.length > 0) return fromList.slice(0, max);
  }

  return matchProductsInNormalized(normalizeText(text), catalog, max);
}

function mergeProductLists(lists, cap, catalog) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const p of list) {
      const full = findInCatalog(catalog, p.fonte, p.id) || p;
      const key = `${full.fonte}:${full.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(enrichProduct(full));
      if (out.length >= cap) return out;
    }
  }
  return out;
}

function extractNicheQuery(userContext) {
  const text = String(userContext || "");
  const lower = text.toLowerCase();

  const nicho = text.match(
    /nicho\s+(?:de\s+)?([a-záàâãéêíóôõúç0-9\s]{3,40}?)(?:\s+que|\s+com|\s+para|,|\.|$)/i
  );
  if (nicho?.[1]) return nicho[1].trim();

  const hints = [
    "tecnologia",
    "tecnlogia",
    "tech",
    "eletronico",
    "eletrónico",
    "beleza",
    "saude",
    "saúde",
    "casa",
    "fitness",
    "cozinha",
    "mascara",
    "led",
    "drone",
  ];
  for (const h of hints) {
    if (lower.includes(h)) return h;
  }

  const words = tokenize(text).filter((w) => w.length >= 5 && !STOPWORDS.has(w));
  return words.slice(0, 2).join(" ") || null;
}

/** Completa até `cap` produtos pesquisando o catálogo (nicho / tags). */
export function fillProductsToLimit(current, cap, userContext, catalog) {
  const out = mergeProductLists([current], cap, catalog);
  if (out.length >= cap) return out.slice(0, cap);

  const seen = new Set(out.map((p) => `${p.fonte}:${p.id}`));
  const query = extractNicheQuery(userContext);

  const searches = [
    query,
    query ? `${query} winner` : null,
    "winner_candidate",
  ].filter(Boolean);

  for (const consulta of searches) {
    const result = filterProducts(catalog.products, {
      consulta,
      tags_contem: consulta.includes("winner") ? undefined : "winner_candidate",
      ordenar: "score",
      limite: cap * 3,
    });
    for (const p of result.produtos) {
      const full = enrichProduct(findInCatalog(catalog, p.fonte, p.id) || p);
      const key = `${full.fonte}:${full.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(full);
      if (out.length >= cap) return out.slice(0, cap);
    }
  }

  if (query && out.length < cap) {
    const broad = filterProducts(catalog.products, {
      consulta: query,
      ordenar: "stock_desc",
      limite: cap * 2,
    });
    for (const p of broad.produtos) {
      const full = enrichProduct(findInCatalog(catalog, p.fonte, p.id) || p);
      const key = `${full.fonte}:${full.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(full);
      if (out.length >= cap) return out.slice(0, cap);
    }
  }

  return out.slice(0, cap);
}

/** Cards finais: junta resposta + ferramentas e preenche até ao limite pedido. */
export function resolveChatProducts(toolProducts, reply, userContext, catalog, limit = CHAT_MAX_PRODUCTS) {
  const cap = Math.min(Math.max(1, limit), CHAT_MAX_PRODUCTS);

  const fromReply = extractProductsMentionedInText(reply, catalog, cap);
  const toolEnriched = toolProducts.map((p) =>
    enrichProduct(findInCatalog(catalog, p.fonte, p.id) || p)
  );

  const merged = mergeProductLists([fromReply, toolEnriched], cap, catalog);

  if (merged.length >= cap) return merged.slice(0, cap);

  if (merged.length === 0) {
    const keywords =
      extractRecommendationKeywords(reply) ||
      extractUpsellQuery(userContext, reply) ||
      extractNicheQuery(userContext);
    if (keywords) {
      const result = filterProducts(catalog.products, {
        consulta: keywords,
        limite: cap,
        ordenar: "score",
      });
      const initial = result.produtos.map((p) =>
        enrichProduct(findInCatalog(catalog, p.fonte, p.id) || p)
      );
      return fillProductsToLimit(initial, cap, userContext, catalog);
    }
  }

  return fillProductsToLimit(merged, cap, userContext, catalog);
}

function extractRecommendationKeywords(reply) {
  const lines = (reply || "").split("\n");
  for (const line of lines) {
    const m = line.match(/^\s*\d+[.)]\s+(.+)/);
    if (m && m[1].length >= 6) {
      return m[1].replace(/\*\*/g, "").split("|")[0].trim().slice(0, 80);
    }
  }
  return null;
}

function extractUpsellQuery(userContext, reply) {
  const text = `${userContext || ""} ${reply || ""}`.toLowerCase();
  if (!/upsell|complemento|complementar|cross.?sell|order bump|adicional/.test(text)) {
    return null;
  }
  const fromReply = extractRecommendationKeywords(reply);
  if (fromReply) return fromReply;
  return null;
}

function compactProduct(p) {
  const base = enrichProduct(p);
  return {
    ...base,
    peso_kg: p.peso ?? null,
    envio_eur: p.envio_eur != null ? Number(p.envio_eur) : null,
    score: p.score_minerado,
    tags: p.tags || "",
  };
}

function findInCatalog(catalog, fonte, id) {
  const want = String(id);
  return catalog.products.find((x) => {
    const matchFonte =
      fonte === "dropipro"
        ? x.fonte === "dropipro" || x.fonte === "dropi"
        : x.fonte === fonte;
    return matchFonte && String(x.id) === want;
  });
}

function compactOpp(o) {
  return {
    match: `${Math.round(Number(o.score) * 100)}%`,
    dropi: {
      id: o.dropi_id,
      nome: o.dropi_nome,
      stock: o.dropi_stock,
      preco: o.dropi_preco,
      url: buildProductUrl("dropipro", o.dropi_id),
    },
    ecomhub: {
      id: o.ecomhub_id,
      nome: o.ecomhub_nome,
      stock: o.ecomhub_stock,
      custo_total: o.custo_ecomhub_total,
      sku: o.ecomhub_sku,
      url: buildProductUrl("ecomhub", o.ecomhub_id),
    },
    stock_ratio: o.stock_ratio,
    tags: o.tags,
    insight: o.insight,
  };
}

/** Produtos devolvidos pelas ferramentas → cards clicáveis no chat. */
export function collectProductsFromToolResult(name, result, catalog) {
  const out = [];

  const pushProduct = (fonte, id) => {
    const p = findInCatalog(catalog, fonte, id);
    if (p) out.push(enrichProduct(p));
  };

  const pushRaw = (p) => {
    if (p?.fonte && p?.id) {
      const full = findInCatalog(catalog, p.fonte, p.id) || p;
      out.push(enrichProduct(full));
    }
  };

  if (!result || result.erro) return out;

  if (name === "pesquisar_catalogo" && Array.isArray(result.produtos)) {
    for (const p of result.produtos) pushRaw(p);
  }

  if (name === "obter_produto" && result.id) {
    pushRaw(result);
  }

  if (name === "listar_oportunidades" && Array.isArray(result.oportunidades)) {
    for (const o of result.oportunidades) {
      pushProduct("dropipro", o.dropi?.id);
      pushProduct("ecomhub", o.ecomhub?.id);
    }
  }

  if (name === "listar_matches" && Array.isArray(result.matches)) {
    for (const m of result.matches) {
      pushProduct("dropipro", m.dropi?.id);
      pushProduct("ecomhub", m.ecomhub?.id);
    }
  }

  return out;
}

function clampLimit(n, max = 80) {
  const x = Number(n) || 30;
  return Math.min(Math.max(1, x), max);
}

function normalizeFonte(fonte) {
  const f = (fonte || "todos").toLowerCase();
  if (f === "dropi" || f === "dropipro") return "dropipro";
  if (f === "ecomhub") return "ecomhub";
  return "todos";
}

function isDropiFonte(fonte) {
  return fonte === "dropipro" || fonte === "dropi";
}

export function getCatalogStats(catalog) {
  const { products, resumo } = catalog;
  const dropi = products.filter((p) => isDropiFonte(p.fonte));
  const ecom = products.filter((p) => p.fonte === "ecomhub");
  const critico = products.filter((p) =>
    (p.tags || "").includes("dropi_critico")
  );
  const altoStock = products.filter((p) =>
    (p.tags || "").includes("alto_stock")
  );

  return {
    resumo,
    totais: {
      produtos_unificados: products.length,
      dropipro: dropi.length,
      ecomhub: ecom.length,
      matches_confiaveis: catalog.matches.length,
      matches_revisar: catalog.matchesRevisar.length,
      oportunidades_estoque: catalog.oportunidades.length,
      ranking_dropi_exclusivos: catalog.rankingDropi?.length ?? 0,
      ranking_ecomhub_exclusivos: catalog.rankingEcomhub?.length ?? 0,
    },
    stock: {
      dropi_stock_total: dropi.reduce((s, p) => s + Number(p.stock || 0), 0),
      ecomhub_stock_total: ecom.reduce((s, p) => s + Number(p.stock || 0), 0),
      dropi_critico: critico.length,
      alto_stock_tag: altoStock.length,
    },
    nota: "Catálogo completo em memória. Usa pesquisar_catalogo para listar/filtrar qualquer produto.",
  };
}

function filterProducts(products, args) {
  let list = [...products];
  const q = (args.consulta || args.query || "").trim();
  const fonte = normalizeFonte(args.fonte);

  if (fonte === "dropipro") list = list.filter((p) => isDropiFonte(p.fonte));
  else if (fonte === "ecomhub") list = list.filter((p) => p.fonte === "ecomhub");

  if (args.stock_min != null)
    list = list.filter((p) => Number(p.stock) >= Number(args.stock_min));
  if (args.stock_max != null)
    list = list.filter((p) => Number(p.stock) <= Number(args.stock_max));
  if (args.preco_min != null)
    list = list.filter((p) => Number(p.preco_eur) >= Number(args.preco_min));
  if (args.preco_max != null)
    list = list.filter((p) => Number(p.preco_eur) <= Number(args.preco_max));

  const tag = args.tags_contem || args.tag;
  if (tag)
    list = list.filter((p) =>
      (p.tags || "").toLowerCase().includes(String(tag).toLowerCase())
    );

  if (q) {
    const found = searchProducts(list, q, Math.min(list.length, 500));
    list = found.length > 0 ? found : list.filter((p) => {
      const text = `${p.nome} ${p.sku}`.toLowerCase();
      return tokenize(q).some((w) => text.includes(w));
    });
  }

  const ordem = args.ordenar || "score";
  if (ordem === "stock_desc")
    list.sort((a, b) => Number(b.stock) - Number(a.stock));
  else if (ordem === "stock_asc")
    list.sort((a, b) => Number(a.stock) - Number(b.stock));
  else if (ordem === "preco_asc")
    list.sort((a, b) => Number(a.preco_eur) - Number(b.preco_eur));
  else if (ordem === "preco_desc")
    list.sort((a, b) => Number(b.preco_eur) - Number(a.preco_eur));
  else list.sort((a, b) => Number(b.score_minerado) - Number(a.score_minerado));

  const limite = clampLimit(args.limite);
  const total = list.length;
  return {
    total_encontrados: total,
    mostrando: Math.min(limite, total),
    produtos: list.slice(0, limite).map(compactProduct),
    filtros: { consulta: q || null, fonte, ...args },
  };
}

export const CATALOG_TOOLS = [
  {
    type: "function",
    function: {
      name: "estatisticas_catalogo",
      description:
        "Visão geral do catálogo completo minerado (totais Dropi, EcomHub, matches, oportunidades). Usa no início ou quando pedirem resumo global.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "pesquisar_catalogo",
      description:
        "Pesquisa e filtra TODOS os produtos do catálogo unificado (~2300). Usa para qualquer pergunta sobre produtos, stock, preços ou nichos.",
      parameters: {
        type: "object",
        properties: {
          consulta: {
            type: "string",
            description: "Texto no nome ou SKU (ex: 'creme', 'led', 'mascara')",
          },
          fonte: {
            type: "string",
            enum: ["todos", "dropipro", "dropi", "ecomhub"],
            description: "Filtrar plataforma (dropi = Dropi PRO)",
          },
          stock_min: { type: "number" },
          stock_max: { type: "number" },
          preco_min: { type: "number" },
          preco_max: { type: "number" },
          tags_contem: {
            type: "string",
            description:
              "Ex: dropi_critico, alto_stock, winner_candidate, dropi_baixo_ecom_alto",
          },
          ordenar: {
            type: "string",
            enum: ["score", "stock_desc", "stock_asc", "preco_asc", "preco_desc"],
          },
          limite: {
            type: "number",
            description: "Máx 80 por chamada (default 40)",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_oportunidades",
      description:
        "Lista oportunidades de stock entre Dropi e EcomHub (pares com match).",
      parameters: {
        type: "object",
        properties: {
          tags_contem: { type: "string" },
          limite: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_matches",
      description: "Lista pares Dropi↔EcomHub com match por nome.",
      parameters: {
        type: "object",
        properties: {
          tipo: {
            type: "string",
            enum: ["confiavel", "revisar", "todos"],
          },
          limite: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "obter_produto",
      description: "Detalhe de um produto por fonte e id.",
      parameters: {
        type: "object",
        properties: {
          fonte: { type: "string", enum: ["dropipro", "dropi", "ecomhub"] },
          id: { type: "string" },
        },
        required: ["fonte", "id"],
        additionalProperties: false,
      },
    },
  },
];

export function executeCatalogTool(name, args, catalog) {
  switch (name) {
    case "estatisticas_catalogo":
      return getCatalogStats(catalog);

    case "pesquisar_catalogo":
      return filterProducts(catalog.products, args || {});

    case "listar_oportunidades": {
      const limite = clampLimit(args?.limite, 50);
      let list = catalog.oportunidades;
      const tag = args?.tags_contem;
      if (tag)
        list = list.filter((o) =>
          (o.tags || "").toLowerCase().includes(tag.toLowerCase())
        );
      return {
        total: list.length,
        oportunidades: list.slice(0, limite).map(compactOpp),
      };
    }

    case "listar_matches": {
      const tipo = args?.tipo || "todos";
      const limite = clampLimit(args?.limite, 50);
      let list = [];
      if (tipo === "confiavel") list = catalog.matches;
      else if (tipo === "revisar") list = catalog.matchesRevisar;
      else list = [...catalog.matches, ...catalog.matchesRevisar];
      return {
        total: list.length,
        matches: list.slice(0, limite).map(compactOpp),
      };
    }

    case "obter_produto": {
      const want = normalizeFonte(args.fonte);
      const p = catalog.products.find((x) => {
        const matchFonte =
          want === "dropipro"
            ? isDropiFonte(x.fonte)
            : x.fonte === want;
        return matchFonte && String(x.id) === String(args.id);
      });
      if (!p)
        return { erro: "Produto não encontrado", fonte: args.fonte, id: args.id };
      return compactProduct(p);
    }

    default:
      return { erro: `Ferramenta desconhecida: ${name}` };
  }
}

export function buildCatalogOverview(catalog) {
  const stats = getCatalogStats(catalog);
  return JSON.stringify(
    {
      ...stats,
      instrucoes:
        "Tens acesso ao catálogo COMPLETO via ferramentas. Para perguntas sobre produtos, chama pesquisar_catalogo (podes fazer várias chamadas com filtros diferentes). Não inventes dados fora das ferramentas.",
    },
    null,
    0
  );
}
