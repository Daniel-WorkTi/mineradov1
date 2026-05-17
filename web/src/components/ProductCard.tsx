import {
  Card,
  CardBody,
  Image,
  Tooltip,
} from "@heroui/react";
import {
  AlertTriangle,
  Package,
  Scale,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import { useCatalogNav } from "../context/CatalogNavContext";
import { useProductImage } from "../hooks/useProductImage";
import type { Product } from "../types";
import { formatEuro, parseNum, stockLabel } from "../utils";

interface ProductCardProps {
  product: Product;
  highlighted?: boolean;
}

const FONTE_CONFIG = {
  dropipro: {
    label: "Dropi PRO",
    chip: "border-amber-900/50 bg-amber-950/40 text-amber-200/90",
  },
  ecomhub: {
    label: "EcomHub",
    chip: "border-blue-900/50 bg-blue-950/40 text-blue-200/90",
  },
};

export function ProductCard({ product, highlighted }: ProductCardProps) {
  const openInCatalog = useCatalogNav();
  const cfg = FONTE_CONFIG[product.fonte];
  const stock = stockLabel(product.stock);
  const score = parseNum(product.score_minerado);
  const { src, onError, isPlaceholder } = useProductImage(
    product.imagem,
    product.fonte,
    product.nome
  );
  const tags = (product.tags || "").split(",").filter(Boolean);
  const tagLabels: Record<
    string,
    { label: string; className: string }
  > = {
    dropi_critico: {
      label: "Stock crítico",
      className: "border-red-900/50 bg-red-950/30 text-red-300",
    },
    dropi_stock_baixo: {
      label: "Stock baixo",
      className: "border-zinc-700 bg-zinc-800/50 text-zinc-300",
    },
    winner_candidate: {
      label: "Winner",
      className: "border-emerald-900/50 bg-emerald-950/30 text-emerald-300",
    },
    alto_stock: {
      label: "Alto stock",
      className: "border-zinc-700 bg-zinc-800/50 text-zinc-300",
    },
    preco_ideal_teste: {
      label: "Preço teste",
      className: "border-zinc-700 bg-zinc-800/50 text-zinc-300",
    },
  };

  return (
    <Card
      id={`catalog-product-${product.fonte}-${product.id}`}
      isPressable={Boolean(openInCatalog)}
      onPress={() => openInCatalog?.(product.fonte, product.id)}
      className={`overflow-hidden border border-zinc-800 bg-zinc-900/40 transition-colors hover:border-zinc-600 hover:bg-zinc-900/70 ${
        openInCatalog ? "cursor-pointer" : ""
      } ${
        highlighted
          ? "ring-2 ring-zinc-100 ring-offset-2 ring-offset-zinc-950"
          : ""
      }`}
      shadow="none"
      radius="lg"
    >
      <CardBody className="gap-0 overflow-hidden p-0">
        <div className="relative border-b border-zinc-800/80">
          <Image
            removeWrapper
            alt={product.nome}
            className="h-44 w-full object-cover"
            src={src}
            onError={onError}
          />
          {isPlaceholder && (
            <div className="absolute bottom-2 left-2">
              <span className="rounded-md border border-zinc-700 bg-zinc-950/90 px-2 py-0.5 text-[10px] text-zinc-400">
                Sem foto
              </span>
            </div>
          )}
          <div className="absolute left-2 top-2">
            <span
              className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${cfg.chip}`}
            >
              {cfg.label}
            </span>
          </div>
          <div className="absolute right-2 top-2">
            <Tooltip content="Score do minerador">
              <span className="flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-950/90 px-2 py-0.5 text-[11px] tabular-nums text-zinc-300">
                <TrendingUp className="h-3 w-3" />
                {score.toFixed(1)}
              </span>
            </Tooltip>
          </div>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug text-zinc-100">
            {product.nome}
          </h3>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.slice(0, 3).map((t) => {
                const meta = tagLabels[t];
                if (!meta) return null;
                return (
                  <span
                    key={t}
                    className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${meta.className}`}
                  >
                    {t === "dropi_critico" && (
                      <AlertTriangle className="h-2.5 w-2.5" />
                    )}
                    {meta.label}
                  </span>
                );
              })}
            </div>
          )}

          <div className="flex items-end justify-between gap-2 border-t border-zinc-800/80 pt-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Fornecedor
              </p>
              <p className="text-xl font-semibold tabular-nums text-zinc-50">
                {formatEuro(product.preco_eur)}
              </p>
            </div>
            <span
              className={`rounded-md border px-2 py-1 text-[11px] font-medium ${
                stock.color === "danger"
                  ? "border-red-900/50 text-red-400"
                  : stock.color === "warning"
                    ? "border-amber-900/50 text-amber-400"
                    : "border-zinc-700 text-zinc-400"
              }`}
            >
              <Package className="mr-1 inline h-3 w-3" />
              {stock.text}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 text-[11px] text-zinc-500">
            {product.sku && (
              <span className="rounded border border-zinc-800 bg-zinc-950/50 px-1.5 py-0.5">
                SKU {product.sku}
              </span>
            )}
            {product.peso && (
              <span className="flex items-center gap-1 rounded border border-zinc-800 bg-zinc-950/50 px-1.5 py-0.5">
                <Scale className="h-3 w-3" />
                {product.peso} kg
              </span>
            )}
            {product.envio_eur && (
              <span className="rounded border border-zinc-800 bg-zinc-950/50 px-1.5 py-0.5">
                Envio {formatEuro(product.envio_eur)}
              </span>
            )}
          </div>

          {product.armazem && (
            <p className="flex items-center gap-1 truncate text-[11px] text-zinc-500">
              <Warehouse className="h-3 w-3 shrink-0" />
              {product.armazem}
            </p>
          )}

          {openInCatalog && (
            <p className="text-[11px] font-medium text-zinc-500">
              Clica para ver no catálogo →
            </p>
          )}
        </div>
      </CardBody>

    </Card>
  );
}
