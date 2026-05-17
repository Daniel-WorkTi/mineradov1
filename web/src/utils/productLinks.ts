import type { Fonte } from "../types";

export interface ChatProductLink {
  fonte: Fonte | string;
  id: string;
  nome: string;
  sku: string | null;
  preco_eur: number;
  stock: number;
  imagem: string | null;
  plataforma: string;
}

export function buildProductUrl(
  fonte: string,
  id: string,
  _sku?: string | null
): string | null {
  const f = fonte.toLowerCase();
  const pid = String(id).trim();
  if (!pid) return null;

  if (f === "dropipro" || f === "dropi") {
    return `https://dropipro.com/app/products/${pid}`;
  }
  if (f === "ecomhub") {
    return `https://app.ecomhub.app/products/${pid}`;
  }
  return null;
}
