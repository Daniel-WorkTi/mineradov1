import { Navbar, NavbarBrand, NavbarContent } from "@heroui/react";
import { LayoutGrid } from "lucide-react";
import type { Resumo } from "../types";

interface HeaderProps {
  resumo: Resumo | null;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="hidden flex-col items-end sm:flex">
      <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <span className="text-sm font-semibold tabular-nums text-zinc-100">
        {value}
      </span>
    </div>
  );
}

export function Header({ resumo }: HeaderProps) {
  return (
    <Navbar
      maxWidth="full"
      className="border-b border-zinc-800/80 bg-zinc-950"
      height="4rem"
    >
      <NavbarBrand className="gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900">
          <LayoutGrid className="h-4 w-4 text-zinc-100" strokeWidth={1.75} />
        </div>
        <div className="flex flex-col">
          <span className="text-base font-semibold tracking-tight text-zinc-50">
            Minerador
          </span>
          <span className="text-[11px] text-zinc-500">
            Dropi PRO × EcomHub · Espanha
          </span>
        </div>
      </NavbarBrand>

      {resumo && (
        <NavbarContent justify="end" className="gap-6">
          <Stat
            label="Catálogo"
            value={resumo.minerado_unificado.toLocaleString("pt-PT")}
          />
          <Stat label="Matches" value={resumo.matches_confiaveis} />
          <Stat label="Dropi" value={resumo.dropi_total} />
          <Stat label="EcomHub" value={resumo.ecomhub_total} />
        </NavbarContent>
      )}
    </Navbar>
  );
}
