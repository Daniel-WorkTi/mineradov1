import { readFileSync } from "fs";
import { join } from "path";

export function loadCatalog(dataDir) {
  const read = (name) =>
    JSON.parse(readFileSync(join(dataDir, name), "utf8"));

  const safe = (name) => {
    try {
      return read(name);
    } catch {
      return [];
    }
  };

  return {
    products: read("minerado.json"),
    matches: safe("matches.json"),
    matchesRevisar: safe("matches_revisar.json"),
    oportunidades: safe("oportunidades.json"),
    rankingDropi: safe("ranking_dropi.json"),
    rankingEcomhub: safe("ranking_ecomhub.json"),
    resumo: read("resumo.json"),
  };
}

export function reloadCatalog(dataDir) {
  return loadCatalog(dataDir);
}

function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);
}

export function searchProducts(products, query, limit = 40) {
  const words = tokenize(query);
  if (words.length === 0) {
    return [...products]
      .sort((a, b) => Number(b.score_minerado) - Number(a.score_minerado))
      .slice(0, limit);
  }

  return products
    .map((p) => {
      const text = `${p.nome} ${p.sku} ${p.fonte} ${p.tags || ""}`.toLowerCase();
      const score = words.reduce((s, w) => s + (text.includes(w) ? 1 : 0), 0);
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);
}

