import { Input, Select, SelectItem, Tab, Tabs } from "@heroui/react";
import { Filter, Search, SortDesc } from "lucide-react";
import type { TabKey } from "../types";

interface ToolbarProps {
  tab: TabKey;
  onTabChange: (tab: TabKey) => void;
  search: string;
  onSearchChange: (v: string) => void;
  fonte: string;
  onFonteChange: (v: string) => void;
  sort: string;
  onSortChange: (v: string) => void;
  counts: Record<TabKey, number>;
  hideCatalogFilters?: boolean;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "oportunidades", label: "Oportunidades" },
  { key: "todos", label: "Todos" },
  { key: "matches", label: "Matches" },
  { key: "revisar", label: "Revisar" },
  { key: "dropi", label: "Só Dropi" },
  { key: "ecomhub", label: "Só EcomHub" },
];

const inputClass = {
  inputWrapper:
    "border-zinc-800 bg-zinc-900/80 shadow-none data-[hover=true]:border-zinc-700 group-data-[focus=true]:border-zinc-500",
};

export function Toolbar({
  tab,
  onTabChange,
  search,
  onSearchChange,
  fonte,
  onFonteChange,
  sort,
  onSortChange,
  counts,
  hideCatalogFilters,
}: ToolbarProps) {
  return (
    <div className="sticky top-0 z-20 border-b border-zinc-800/80 bg-zinc-950/95 px-4 py-4 backdrop-blur-md md:px-8">
      <Tabs
        selectedKey={tab}
        onSelectionChange={(k) => onTabChange(k as TabKey)}
        variant="underlined"
        classNames={{
          tabList: "gap-1 w-full p-0 border-b border-zinc-800",
          cursor: "bg-zinc-100",
          tab: "h-10 px-3 text-zinc-500 data-[selected=true]:text-zinc-50",
          tabContent: "text-sm font-medium",
        }}
      >
        {TABS.map((t) => (
          <Tab
            key={t.key}
            title={
              <span className="flex items-center gap-2">
                {t.label}
                <span className="rounded-md bg-zinc-800/80 px-1.5 py-0.5 text-[11px] font-normal tabular-nums text-zinc-400">
                  {counts[t.key]}
                </span>
              </span>
            }
          />
        ))}
      </Tabs>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end">
        <Input
          className="lg:max-w-md"
          placeholder="Buscar por nome, SKU ou ID…"
          value={search}
          onValueChange={onSearchChange}
          startContent={<Search className="h-4 w-4 text-zinc-500" />}
          variant="bordered"
          classNames={inputClass}
          isClearable
          onClear={() => onSearchChange("")}
        />

        {!hideCatalogFilters && (
          <Select
            className="lg:max-w-[180px]"
            label="Fonte"
            selectedKeys={new Set([fonte])}
            onSelectionChange={(keys) => {
              const v = Array.from(keys)[0]?.toString();
              if (v) onFonteChange(v);
            }}
            startContent={<Filter className="h-4 w-4 text-zinc-500" />}
            variant="bordered"
            classNames={{ trigger: inputClass.inputWrapper }}
          >
            <SelectItem key="all">Todas</SelectItem>
            <SelectItem key="dropipro">Dropi PRO</SelectItem>
            <SelectItem key="ecomhub">EcomHub</SelectItem>
          </Select>
        )}

        {!hideCatalogFilters && (
          <Select
            className="lg:max-w-[200px]"
            label="Ordenar"
            selectedKeys={new Set([sort])}
            onSelectionChange={(keys) => {
              const v = Array.from(keys)[0]?.toString();
              if (v) onSortChange(v);
            }}
            startContent={<SortDesc className="h-4 w-4 text-zinc-500" />}
            variant="bordered"
            classNames={{ trigger: inputClass.inputWrapper }}
          >
            <SelectItem key="score">Score minerado</SelectItem>
            <SelectItem key="price-asc">Preço ↑</SelectItem>
            <SelectItem key="price-desc">Preço ↓</SelectItem>
            <SelectItem key="stock-desc">Stock ↓</SelectItem>
          </Select>
        )}
      </div>
    </div>
  );
}
