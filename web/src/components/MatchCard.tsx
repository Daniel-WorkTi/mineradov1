import { Card, CardBody, Divider } from "@heroui/react";
import {
  ArrowRight,
  CheckCircle2,
  GitCompareArrows,
  Package,
} from "lucide-react";
import { useCatalogNav } from "../context/CatalogNavContext";
import type { Match } from "../types";
import { formatEuro, parseNum } from "../utils";

interface MatchCardProps {
  match: Match;
  variant?: "confiavel" | "revisar";
}

export function MatchCard({ match, variant = "confiavel" }: MatchCardProps) {
  const openInCatalog = useCatalogNav();
  const score = parseNum(match.score);
  const margem = parseNum(match.margem_pct);
  const diff = parseNum(match.diff_preco);
  const maisBaratoDropi = match.mais_barato === "dropi";

  return (
    <Card className="panel border-zinc-800 shadow-none" radius="lg">
      <CardBody className="gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs font-medium text-zinc-300">
            <GitCompareArrows className="h-3.5 w-3.5" />
            Match {Math.round(score * 100)}%
            {variant === "revisar" && " · revisar"}
          </span>
          <span className="text-xs tabular-nums text-zinc-500">
            Score {match.score_oportunidade}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr]">
          <SourceBlock
            title="Dropi PRO"
            fonte="dropipro"
            productId={match.dropi_id}
            badgeClass="border-amber-900/50 bg-amber-950/40 text-amber-200/90"
            nome={match.dropi_nome}
            preco={match.dropi_preco}
            stock={match.dropi_stock}
            highlight={maisBaratoDropi}
            onOpen={openInCatalog}
          />

          <div className="flex flex-col items-center justify-center gap-2 px-2">
            <ArrowRight className="hidden h-5 w-5 text-zinc-600 md:block" />
            <span
              className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                maisBaratoDropi
                  ? "border-emerald-900/50 text-emerald-400"
                  : "border-zinc-700 text-zinc-400"
              }`}
            >
              {maisBaratoDropi ? "Dropi − barato" : "EcomHub − barato"}
            </span>
            <p className="text-sm font-semibold tabular-nums text-zinc-100">
              Δ {formatEuro(Math.abs(diff))}
            </p>
            <p className="text-xs text-zinc-500">Margem ~{margem}%</p>
          </div>

          <SourceBlock
            title="EcomHub"
            fonte="ecomhub"
            productId={match.ecomhub_id}
            badgeClass="border-blue-900/50 bg-blue-950/40 text-blue-200/90"
            nome={match.ecomhub_nome}
            preco={match.custo_ecomhub_total}
            stock={match.ecomhub_stock}
            sku={match.ecomhub_sku}
            highlight={!maisBaratoDropi}
            sublabel="preço + envio"
            onOpen={openInCatalog}
          />
        </div>

        <Divider className="bg-zinc-800" />
      </CardBody>
    </Card>
  );
}

function SourceBlock({
  title,
  fonte,
  productId,
  badgeClass,
  nome,
  preco,
  stock,
  sku,
  highlight,
  sublabel,
  onOpen,
}: {
  title: string;
  fonte: string;
  productId: string;
  badgeClass: string;
  nome: string;
  preco: string;
  stock: string;
  sku?: string;
  highlight?: boolean;
  sublabel?: string;
  onOpen: ((fonte: string, id: string) => void) | null;
}) {
  const clickable = Boolean(onOpen && productId);

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => onOpen?.(fonte, productId)}
      className={`w-full rounded-lg border p-4 text-left transition-colors ${
        highlight
          ? "border-zinc-500 bg-zinc-800/30"
          : "border-zinc-800 bg-zinc-950/40"
      } ${clickable ? "cursor-pointer hover:border-zinc-600 hover:bg-zinc-900/60" : "cursor-default"}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span
          className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${badgeClass}`}
        >
          {title}
        </span>
        {highlight && (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-label="Mais barato" />
        )}
      </div>
      <p className="mb-2 line-clamp-2 text-sm font-medium text-zinc-200">{nome}</p>
      <p className="text-xl font-semibold tabular-nums text-zinc-50">
        {formatEuro(preco)}
      </p>
      {sublabel && <p className="text-xs text-zinc-500">{sublabel}</p>}
      <p className="mt-2 flex items-center gap-1 text-xs text-zinc-500">
        <Package className="h-3 w-3" />
        Stock {parseNum(stock).toLocaleString("pt-PT")}
      </p>
      {sku && <p className="mt-1 text-xs text-zinc-600">SKU {sku}</p>}
      {clickable && (
        <p className="mt-3 text-[11px] font-medium text-zinc-500">
          Ver no catálogo →
        </p>
      )}
    </button>
  );
}
