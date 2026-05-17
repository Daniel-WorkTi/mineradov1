export type Fonte = "dropipro" | "ecomhub";

export interface Product {
  fonte: Fonte;
  id: string;
  nome: string;
  sku: string;
  preco_eur: string;
  stock: string;
  peso: string;
  envio_eur: string;
  armazem: string;
  imagem: string;
  link: string;
  score_minerado: string;
  tags?: string;
}

export interface Match {
  score: string;
  dropi_id: string;
  dropi_nome: string;
  dropi_preco: string;
  dropi_stock: string;
  ecomhub_id: string;
  ecomhub_nome: string;
  ecomhub_sku: string;
  ecomhub_preco: string;
  ecomhub_envio: string;
  ecomhub_stock: string;
  custo_ecomhub_total: string;
  diff_preco: string;
  mais_barato: string;
  margem_pct: string;
  score_oportunidade: string;
}

export interface StockOpportunity extends Match {
  tags: string;
  insight: string;
  stock_ratio: string;
}

export interface Resumo {
  dropi_total: number;
  ecomhub_total: number;
  minerado_unificado: number;
  matches_confiaveis: number;
  matches_revisar: number;
  dropi_exclusivos: number;
  ecomhub_exclusivos: number;
  oportunidades_estoque?: number;
  dropi_baixo_ecom_alto?: number;
  atualizado_em?: string;
}

export type TabKey =
  | "todos"
  | "oportunidades"
  | "matches"
  | "revisar"
  | "dropi"
  | "ecomhub";

export type MiningPreset =
  | "all"
  | "dropi_baixo_ecom_alto"
  | "dropi_critico"
  | "winner_candidate"
  | "margem_dropi"
  | "alto_stock"
  | "preco_ideal_teste";
