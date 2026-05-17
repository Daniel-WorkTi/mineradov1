import type { MiningPreset, Product, StockOpportunity } from "./types";
import { parseNum } from "./utils";

export const MINING_PRESETS: {
  id: MiningPreset;
  label: string;
  description: string;
  color: "warning" | "success" | "danger" | "primary" | "secondary";
}[] = [
  {
    id: "dropi_baixo_ecom_alto",
    label: "Dropi baixo · EcomHub alto",
    description: "Pouco stock Dropi, muito no EcomHub — demanda + reserva",
    color: "warning",
  },
  {
    id: "dropi_critico",
    label: "Stock crítico Dropi",
    description: "Menos de 50 unidades — risco de rutura",
    color: "danger",
  },
  {
    id: "winner_candidate",
    label: "Candidatos winner",
    description: "Stock alto + preço ideal para testar campanha",
    color: "success",
  },
  {
    id: "margem_dropi",
    label: "Margem Dropi",
    description: "Mesmo produto mais barato no Dropi",
    color: "warning",
  },
  {
    id: "alto_stock",
    label: "Alto stock",
    description: "1000+ unidades — escala com segurança",
    color: "primary",
  },
  {
    id: "preco_ideal_teste",
    label: "Preço ideal teste",
    description: "Entre 2€ e 12€ — faixa típica de impulso",
    color: "secondary",
  },
];

export function productHasTag(p: Product, tag: string): boolean {
  return (p.tags || "").split(",").includes(tag);
}

export function opportunityHasTag(o: StockOpportunity, tag: string): boolean {
  return (o.tags || "").split(",").includes(tag);
}

export function filterProductsByPreset(
  products: Product[],
  preset: MiningPreset
): Product[] {
  if (preset === "all") return products;

  return products.filter((p) => {
    switch (preset) {
      case "dropi_critico":
        return productHasTag(p, "dropi_critico");
      case "winner_candidate":
        return productHasTag(p, "winner_candidate");
      case "alto_stock":
        return productHasTag(p, "alto_stock");
      case "preco_ideal_teste":
        return productHasTag(p, "preco_ideal_teste");
      case "dropi_baixo_ecom_alto":
        return productHasTag(p, "dropi_stock_baixo");
      default:
        return true;
    }
  });
}

export function filterOpportunitiesByPreset(
  list: StockOpportunity[],
  preset: MiningPreset
): StockOpportunity[] {
  if (preset === "all") return list;
  if (preset === "dropi_baixo_ecom_alto")
    return list.filter((o) => opportunityHasTag(o, "dropi_baixo_ecom_alto"));
  if (preset === "dropi_critico")
    return list.filter((o) => opportunityHasTag(o, "dropi_critico"));
  if (preset === "margem_dropi")
    return list.filter((o) => opportunityHasTag(o, "margem_dropi"));
  if (preset === "winner_candidate")
    return list.filter(
      (o) => opportunityHasTag(o, "escalar_dropi") || opportunityHasTag(o, "escalar_ecomhub")
    );
  if (preset === "alto_stock")
    return list.filter((o) => parseNum(o.ecomhub_stock) >= 1000 || parseNum(o.dropi_stock) >= 1000);
  return list;
}

export function countProductsByPreset(
  products: Product[],
  preset: MiningPreset
): number {
  return filterProductsByPreset(products, preset).length;
}

export function countOpportunitiesByPreset(
  list: StockOpportunity[],
  preset: MiningPreset
): number {
  return filterOpportunitiesByPreset(list, preset).length;
}
