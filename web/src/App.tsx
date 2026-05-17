import { useCallback, useMemo, useState } from "react";
import { Pagination, Spinner } from "@heroui/react";
import { ChatAssistant } from "./components/ChatAssistant";
import { CatalogNavProvider } from "./context/CatalogNavContext";
import { DataFreshnessBanner } from "./components/DataFreshnessBanner";
import { Header } from "./components/Header";
import { MatchCard } from "./components/MatchCard";
import { MiningFilters } from "./components/MiningFilters";
import { ProductCard } from "./components/ProductCard";
import { StockOpportunityCard } from "./components/StockOpportunityCard";
import { Toolbar } from "./components/Toolbar";
import { useCatalogData } from "./hooks/useCatalogData";
import {
  countOpportunitiesByPreset,
  countProductsByPreset,
  filterOpportunitiesByPreset,
  filterProductsByPreset,
} from "./miningFilters";
import type { MiningPreset, Product, TabKey } from "./types";
import { parseNum } from "./utils";
import type { CatalogHighlight } from "./utils/openInCatalog";
import {
  findProduct,
  normalizeFonte,
  pageForProductIndex,
  scrollToCatalogProduct,
} from "./utils/openInCatalog";

const PAGE_SIZE = 24;

function filterProducts(
  products: Product[],
  tab: TabKey,
  search: string,
  fonte: string,
  preset: MiningPreset,
  dropiIds: Set<string>,
  ecomIds: Set<string>
): Product[] {
  let list = products;

  if (tab === "dropi") {
    list = list.filter((p) => p.fonte === "dropipro" && !dropiIds.has(p.id));
  } else if (tab === "ecomhub") {
    list = list.filter((p) => p.fonte === "ecomhub" && !ecomIds.has(p.id));
  }

  if (fonte !== "all") {
    list = list.filter((p) => p.fonte === fonte);
  }

  list = filterProductsByPreset(list, preset);

  const q = search.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (p) =>
        p.nome.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
    );
  }

  return list;
}

function sortProducts(list: Product[], sort: string): Product[] {
  const copy = [...list];
  switch (sort) {
    case "price-asc":
      return copy.sort((a, b) => parseNum(a.preco_eur) - parseNum(b.preco_eur));
    case "price-desc":
      return copy.sort((a, b) => parseNum(b.preco_eur) - parseNum(a.preco_eur));
    case "stock-desc":
      return copy.sort((a, b) => parseNum(b.stock) - parseNum(a.stock));
    default:
      return copy.sort(
        (a, b) => parseNum(b.score_minerado) - parseNum(a.score_minerado)
      );
  }
}

export default function App() {
  const {
    products,
    matches,
    matchesRevisar,
    oportunidades,
    resumo,
    loading,
    error,
  } = useCatalogData();

  const [tab, setTab] = useState<TabKey>("oportunidades");
  const [search, setSearch] = useState("");
  const [fonte, setFonte] = useState("all");
  const [sort, setSort] = useState("score");
  const [preset, setPreset] = useState<MiningPreset>("all");
  const [page, setPage] = useState(1);
  const [highlight, setHighlight] = useState<CatalogHighlight>(null);

  const matchedDropiIds = useMemo(
    () => new Set(matches.map((m) => m.dropi_id)),
    [matches]
  );
  const matchedEcomIds = useMemo(
    () => new Set(matches.map((m) => m.ecomhub_id)),
    [matches]
  );

  const filteredOportunidades = useMemo(() => {
    let list = filterOpportunitiesByPreset(oportunidades, preset);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (o) =>
          o.dropi_nome.toLowerCase().includes(q) ||
          o.ecomhub_nome.toLowerCase().includes(q) ||
          o.ecomhub_sku.toLowerCase().includes(q)
      );
    }
    return list;
  }, [oportunidades, preset, search]);

  const filtered = useMemo(() => {
    const list = filterProducts(
      products,
      tab,
      search,
      fonte,
      preset,
      matchedDropiIds,
      matchedEcomIds
    );
    return sortProducts(list, sort);
  }, [
    products,
    tab,
    search,
    fonte,
    preset,
    sort,
    matchedDropiIds,
    matchedEcomIds,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const oppPageSize = 12;
  const oppTotalPages = Math.max(
    1,
    Math.ceil(filteredOportunidades.length / oppPageSize)
  );
  const oppPageItems = filteredOportunidades.slice(
    (page - 1) * oppPageSize,
    page * oppPageSize
  );

  const presetCounts = useMemo(() => {
    const base =
      tab === "oportunidades" ? oportunidades : products;
    return {
      all: base.length,
      dropi_baixo_ecom_alto:
        tab === "oportunidades"
          ? countOpportunitiesByPreset(oportunidades, "dropi_baixo_ecom_alto")
          : countProductsByPreset(products, "dropi_baixo_ecom_alto"),
      dropi_critico:
        tab === "oportunidades"
          ? countOpportunitiesByPreset(oportunidades, "dropi_critico")
          : countProductsByPreset(products, "dropi_critico"),
      winner_candidate:
        tab === "oportunidades"
          ? countOpportunitiesByPreset(oportunidades, "winner_candidate")
          : countProductsByPreset(products, "winner_candidate"),
      margem_dropi: countOpportunitiesByPreset(oportunidades, "margem_dropi"),
      alto_stock:
        tab === "oportunidades"
          ? countOpportunitiesByPreset(oportunidades, "alto_stock")
          : countProductsByPreset(products, "alto_stock"),
      preco_ideal_teste: countProductsByPreset(products, "preco_ideal_teste"),
    };
  }, [products, oportunidades, tab]);

  const openInCatalog = useCallback(
    (fonte: string, id: string) => {
      const product = findProduct(products, fonte, id);
      if (!product) return;

      const norm = normalizeFonte(fonte);
      setTab("todos");
      setFonte(norm);
      setPreset("all");
      setSearch(String(product.id));
      setPage(1);

      const list = sortProducts(
        filterProducts(
          products,
          "todos",
          String(product.id),
          norm,
          "all",
          matchedDropiIds,
          matchedEcomIds
        ),
        sort
      );
      const idx = list.findIndex(
        (p) => p.fonte === product.fonte && p.id === product.id
      );
      if (idx >= 0) {
        setPage(pageForProductIndex(idx, PAGE_SIZE));
      }

      setHighlight({ fonte: product.fonte, id: product.id });
      scrollToCatalogProduct(product.fonte, product.id);

      setTimeout(() => setHighlight(null), 8000);
    },
    [products, sort, matchedDropiIds, matchedEcomIds]
  );

  const counts: Record<TabKey, number> = useMemo(
    () => ({
      oportunidades: oportunidades.length,
      todos: products.length,
      matches: matches.length,
      revisar: matchesRevisar.length,
      dropi: products.filter(
        (p) => p.fonte === "dropipro" && !matchedDropiIds.has(p.id)
      ).length,
      ecomhub: products.filter(
        (p) => p.fonte === "ecomhub" && !matchedEcomIds.has(p.id)
      ).length,
    }),
    [products, matches, matchesRevisar, oportunidades, matchedDropiIds, matchedEcomIds]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950">
        <Spinner size="lg" color="default" />
        <p className="text-sm text-zinc-500">A carregar catálogo…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center">
        <p className="max-w-md text-danger">{error}</p>
      </div>
    );
  }

  const showProductGrid =
    tab === "todos" || tab === "dropi" || tab === "ecomhub";

  return (
    <CatalogNavProvider onOpenInCatalog={openInCatalog}>
    <div className="min-h-screen">
      <Header resumo={resumo} />

      <Toolbar
        tab={tab}
        onTabChange={(t) => {
          setTab(t);
          setPage(1);
          if (t === "oportunidades" && preset === "all")
            setPreset("dropi_baixo_ecom_alto");
        }}
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        fonte={fonte}
        onFonteChange={setFonte}
        sort={sort}
        onSortChange={setSort}
        counts={counts}
        hideCatalogFilters={tab === "oportunidades"}
      />

      <main className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 md:px-8">
        <DataFreshnessBanner atualizadoEm={resumo?.atualizado_em} />

        <MiningFilters
          preset={preset}
          onPresetChange={(p) => {
            setPreset(p);
            setPage(1);
          }}
          counts={presetCounts}
        />

        {tab === "oportunidades" && (
          <>
            <p className="text-sm text-zinc-500">
              Cruzamento Dropi × EcomHub ·{" "}
              <span className="text-zinc-300">
                Dropi baixo + EcomHub alto
              </span>{" "}
              ({resumo?.dropi_baixo_ecom_alto ?? 0} sinais)
            </p>
            {oppPageItems.length === 0 ? (
              <Empty message="Nenhuma oportunidade com este filtro." />
            ) : (
              <div className="flex flex-col gap-4">
                {oppPageItems.map((o) => (
                  <StockOpportunityCard
                    key={`${o.dropi_id}-${o.ecomhub_id}`}
                    item={o}
                  />
                ))}
              </div>
            )}
            {oppTotalPages > 1 && (
              <div className="flex justify-center">
                <Pagination
                  total={oppTotalPages}
                  page={page}
                  onChange={setPage}
                  classNames={{
                    wrapper: "gap-1",
                    item: "bg-zinc-800 text-zinc-400",
                    cursor: "bg-zinc-100",
                  }}
                  showControls
                />
              </div>
            )}
          </>
        )}

        {tab === "matches" && (
          <div className="flex flex-col gap-4">
            {matches.length === 0 ? (
              <Empty message="Nenhum match confiável encontrado." />
            ) : (
              matches.map((m) => (
                <MatchCard key={`${m.dropi_id}-${m.ecomhub_id}`} match={m} />
              ))
            )}
          </div>
        )}

        {tab === "revisar" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-zinc-500">
              Possíveis produtos iguais — confirme manualmente.
            </p>
            {matchesRevisar.map((m) => (
              <MatchCard
                key={`${m.dropi_id}-${m.ecomhub_id}`}
                match={m}
                variant="revisar"
              />
            ))}
          </div>
        )}

        {showProductGrid && (
          <>
            <p className="text-sm text-zinc-500">
              {pageItems.length} de {filtered.length.toLocaleString("pt-PT")} produtos
            </p>
            {pageItems.length === 0 ? (
              <Empty message="Nenhum produto com esses filtros." />
            ) : (
              <div className="product-grid">
                {pageItems.map((p) => (
                  <ProductCard
                    key={`${p.fonte}-${p.id}`}
                    product={p}
                    highlighted={
                      highlight?.fonte === p.fonte && highlight?.id === p.id
                    }
                  />
                ))}
              </div>
            )}
            {totalPages > 1 && (
              <div className="mt-10 flex justify-center">
                <Pagination
                  total={totalPages}
                  page={page}
                  onChange={setPage}
                  classNames={{
                    wrapper: "gap-1",
                    item: "bg-zinc-800 text-zinc-400",
                    cursor: "bg-zinc-100",
                  }}
                  showControls
                />
              </div>
            )}
          </>
        )}
      </main>

      <ChatAssistant onOpenInCatalog={openInCatalog} />
    </div>
    </CatalogNavProvider>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 py-16 text-center text-sm text-zinc-500">
      {message}
    </div>
  );
}
