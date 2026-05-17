import { Card, CardBody, Progress } from "@heroui/react";
import {
  AlertTriangle,
  ArrowRightLeft,
  Package,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCatalogNav } from "../context/CatalogNavContext";
import type { StockOpportunity } from "../types";
import { formatEuro, parseNum } from "../utils";

interface StockOpportunityCardProps {
  item: StockOpportunity;
}

export function StockOpportunityCard({ item }: StockOpportunityCardProps) {
  const openInCatalog = useCatalogNav();
  const dropiStock = parseNum(item.dropi_stock);
  const ecomStock = parseNum(item.ecomhub_stock);
  const maxStock = Math.max(dropiStock, ecomStock, 1);
  const ratio = parseNum(item.stock_ratio);
  const tags = (item.tags || "").split(",").filter(Boolean);

  const dropiPct = Math.min(100, (dropiStock / maxStock) * 100);
  const ecomPct = Math.min(100, (ecomStock / maxStock) * 100);

  return (
    <Card className="panel border-zinc-800 shadow-none" radius="lg">
      <CardBody className="gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {tags.includes("dropi_baixo_ecom_alto") && (
              <Tag icon={<ArrowRightLeft className="h-3 w-3" />}>
                Dropi baixo · EcomHub alto
              </Tag>
            )}
            {tags.includes("dropi_critico") && (
              <Tag icon={<AlertTriangle className="h-3 w-3" />} danger>
                Stock crítico Dropi
              </Tag>
            )}
            {tags.includes("demanda_alta") && (
              <Tag>Demanda ×{ratio}</Tag>
            )}
            {tags.includes("margem_dropi") && (
              <Tag success>Margem Dropi</Tag>
            )}
          </div>
          <span className="text-xs tabular-nums text-zinc-500">
            Match {Math.round(parseNum(item.score) * 100)}%
          </span>
        </div>

        <div className="grid gap-1 sm:grid-cols-2">
          <button
            type="button"
            disabled={!openInCatalog}
            onClick={() => openInCatalog?.("dropipro", item.dropi_id)}
            className={`rounded-lg p-2 text-left transition-colors ${
              openInCatalog
                ? "cursor-pointer hover:bg-zinc-900/60"
                : "cursor-default"
            }`}
          >
            <p className="font-medium text-zinc-100">{item.dropi_nome}</p>
            {openInCatalog && (
              <p className="mt-1 text-[11px] font-medium text-zinc-500">
                Ver Dropi no catálogo →
              </p>
            )}
          </button>
          <button
            type="button"
            disabled={!openInCatalog}
            onClick={() => openInCatalog?.("ecomhub", item.ecomhub_id)}
            className={`rounded-lg p-2 text-left transition-colors ${
              openInCatalog
                ? "cursor-pointer hover:bg-zinc-900/60"
                : "cursor-default"
            }`}
          >
            <p className="text-xs text-zinc-500">{item.ecomhub_nome}</p>
            {openInCatalog && (
              <p className="mt-1 text-[11px] font-medium text-zinc-500">
                Ver EcomHub no catálogo →
              </p>
            )}
          </button>
        </div>

        {item.insight && (
          <p className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-400">
            {item.insight}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <StockBar
            label="Dropi PRO"
            fonte="dropipro"
            productId={item.dropi_id}
            stock={dropiStock}
            preco={item.dropi_preco}
            value={dropiPct}
            icon={<TrendingDown className="h-4 w-4 text-amber-500/80" />}
            critical={dropiStock < 50}
            low={dropiStock < 150}
            onOpen={openInCatalog}
          />
          <StockBar
            label="EcomHub"
            fonte="ecomhub"
            productId={item.ecomhub_id}
            stock={ecomStock}
            preco={item.custo_ecomhub_total}
            value={ecomPct}
            icon={<TrendingUp className="h-4 w-4 text-blue-400/80" />}
            critical={false}
            low={false}
            onOpen={openInCatalog}
          />
        </div>
      </CardBody>
    </Card>
  );
}

function Tag({
  children,
  icon,
  danger,
  success,
}: {
  children: ReactNode;
  icon?: ReactNode;
  danger?: boolean;
  success?: boolean;
}) {
  const cls = danger
    ? "border-red-900/50 bg-red-950/30 text-red-300"
    : success
      ? "border-emerald-900/50 bg-emerald-950/30 text-emerald-300"
      : "border-zinc-700 bg-zinc-800/50 text-zinc-300";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {icon}
      {children}
    </span>
  );
}

function StockBar({
  label,
  fonte,
  productId,
  stock,
  preco,
  value,
  icon,
  critical,
  low,
  onOpen,
}: {
  label: string;
  fonte: string;
  productId: string;
  stock: number;
  preco: string;
  value: number;
  icon: ReactNode;
  critical: boolean;
  low: boolean;
  onOpen: ((fonte: string, id: string) => void) | null;
}) {
  const clickable = Boolean(onOpen && productId);

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => onOpen?.(fonte, productId)}
      className={`w-full rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-left transition-colors ${
        clickable ? "cursor-pointer hover:border-zinc-600 hover:bg-zinc-900/60" : "cursor-default"
      }`}
    >
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-medium text-zinc-300">
          {icon}
          {label}
        </span>
        <span
          className={
            critical
              ? "font-medium text-red-400"
              : low
                ? "text-amber-400/90"
                : "text-zinc-500"
          }
        >
          <Package className="mr-1 inline h-3.5 w-3.5" />
          {stock.toLocaleString("pt-PT")}
        </span>
      </div>
      <p className="mb-2 text-lg font-semibold tabular-nums text-zinc-50">
        {formatEuro(preco)}
      </p>
      <Progress
        size="sm"
        value={value}
        classNames={{
          track: "bg-zinc-800",
          indicator: "bg-zinc-400",
        }}
        aria-label={`Stock ${label}`}
      />
      {clickable && (
        <p className="mt-2 text-[11px] font-medium text-zinc-500">
          Ver no catálogo →
        </p>
      )}
    </button>
  );
}
