import type { Product, TabKey } from "../types";
import { parseNum } from "../utils";

export type CatalogHighlight = { fonte: string; id: string } | null;

const PAGE_SIZE = 24;

export function productKey(fonte: string, id: string) {
  return `${fonte}:${id}`;
}

export function normalizeFonte(fonte: string): "dropipro" | "ecomhub" {
  const f = fonte.toLowerCase();
  return f === "ecomhub" ? "ecomhub" : "dropipro";
}

export function findProduct(
  products: Product[],
  fonte: string,
  id: string
): Product | undefined {
  const f = normalizeFonte(fonte);
  return products.find(
    (p) => normalizeFonte(p.fonte) === f && String(p.id) === String(id)
  );
}

/** Lista filtrada como no grid "Todos" (sem preset de mineração). */
export function catalogListForProduct(
  products: Product[],
  product: Product
): Product[] {
  return products
    .filter((p) => p.fonte === product.fonte)
    .sort((a, b) => parseNum(b.score_minerado) - parseNum(a.score_minerado));
}

export function pageForProductIndex(index: number, pageSize = PAGE_SIZE) {
  return index >= 0 ? Math.floor(index / pageSize) + 1 : 1;
}

export function tabForFonte(fonte: string): TabKey {
  return normalizeFonte(fonte) === "dropipro" ? "dropi" : "ecomhub";
}

export function scrollToCatalogProduct(fonte: string, id: string) {
  requestAnimationFrame(() => {
    setTimeout(() => {
      document
        .getElementById(`catalog-product-${fonte}-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  });
}
