import { Button } from "@heroui/react";
import { Clock, RefreshCw } from "lucide-react";

interface DataFreshnessBannerProps {
  atualizadoEm?: string;
}

export function DataFreshnessBanner({ atualizadoEm }: DataFreshnessBannerProps) {
  const formatted = atualizadoEm
    ? new Date(atualizadoEm).toLocaleString("pt-PT", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "desconhecida";

  return (
    <div className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" strokeWidth={1.75} />
        <div>
          <p className="text-sm font-medium text-zinc-200">
            Dados do último export
          </p>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-500">
            Stock e imagens vêm dos catálogos exportados — não são tempo real.
            Atualizado: <span className="text-zinc-400">{formatted}</span>.
            Para atualizar: reexporte →{" "}
            <code className="rounded border border-zinc-800 bg-zinc-950 px-1 font-mono text-[11px] text-zinc-400">
              python3 miner.py
            </code>{" "}
            → recarregue.
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant="bordered"
        className="shrink-0 border-zinc-700 text-zinc-300"
        startContent={<RefreshCw className="h-3.5 w-3.5" />}
        onPress={() => window.location.reload()}
      >
        Recarregar
      </Button>
    </div>
  );
}
