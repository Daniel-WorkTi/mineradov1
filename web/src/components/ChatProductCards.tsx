import { Card, CardBody } from "@heroui/react";
import { ArrowRight, Package } from "lucide-react";
import { useProductImage } from "../hooks/useProductImage";
import type { ChatProductLink } from "../utils/productLinks";
import { formatEuro } from "../utils";

interface Props {
  products: ChatProductLink[];
  onOpenInCatalog: (fonte: string, id: string) => void;
}

function ChatProductCard({
  product,
  onOpen,
}: {
  product: ChatProductLink;
  onOpen: () => void;
}) {
  const fonte =
    product.fonte === "dropipro" || product.fonte === "dropi"
      ? "dropipro"
      : "ecomhub";
  const { src, onError } = useProductImage(
    product.imagem || "",
    fonte,
    product.nome
  );
  const badge =
    fonte === "dropipro"
      ? "border-amber-900/50 bg-amber-950/40 text-amber-200/80"
      : "border-blue-900/50 bg-blue-950/40 text-blue-200/80";

  return (
    <Card
      isPressable
      onPress={onOpen}
      shadow="none"
      className="cursor-pointer border border-zinc-800 bg-zinc-900/50 transition-colors hover:border-zinc-600 hover:bg-zinc-900"
    >
      <CardBody className="flex flex-row gap-3 p-2.5">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-zinc-800 bg-zinc-950">
          {src ? (
            <img
              src={src}
              alt=""
              className="h-full w-full object-cover"
              onError={onError}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-5 w-5 text-zinc-600" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${badge}`}
            >
              {product.plataforma}
            </span>
            <span className="text-[11px] tabular-nums text-zinc-500">
              {formatEuro(product.preco_eur)} · {product.stock} un.
            </span>
          </div>
          <p className="line-clamp-2 text-xs font-medium leading-snug text-zinc-200">
            {product.nome}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">Ver no catálogo →</p>
        </div>
        <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-zinc-500" />
      </CardBody>
    </Card>
  );
}

export function ChatProductCards({ products, onOpenInCatalog }: Props) {
  if (!products.length) return null;

  return (
    <div className="mt-2 w-full max-w-[85%] space-y-2 pl-10">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">
        {products.length} produto{products.length !== 1 ? "s" : ""} · catálogo
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {products.map((p) => (
          <ChatProductCard
            key={`${p.fonte}:${p.id}`}
            product={p}
            onOpen={() => onOpenInCatalog(p.fonte, p.id)}
          />
        ))}
      </div>
    </div>
  );
}
