import { useEffect, useState } from "react";
import type { Match, Product, Resumo, StockOpportunity } from "../types";

interface CatalogData {
  products: Product[];
  matches: Match[];
  matchesRevisar: Match[];
  oportunidades: StockOpportunity[];
  resumo: Resumo | null;
  loading: boolean;
  error: string | null;
}

export function useCatalogData(): CatalogData {
  const [products, setProducts] = useState<Product[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchesRevisar, setMatchesRevisar] = useState<Match[]>([]);
  const [oportunidades, setOportunidades] = useState<StockOpportunity[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [minerado, m, mr, opp, r] = await Promise.all([
          fetch("/data/minerado.json").then((x) => x.json()),
          fetch("/data/matches.json").then((x) => x.json()),
          fetch("/data/matches_revisar.json").then((x) => x.json()),
          fetch("/data/oportunidades.json").then((x) => x.json()).catch(() => []),
          fetch("/data/resumo.json").then((x) => x.json()),
        ]);
        setProducts(minerado);
        setMatches(m);
        setMatchesRevisar(mr);
        setOportunidades(opp);
        setResumo(r);
      } catch (e) {
        setError(
          "Não foi possível carregar os dados. Rode: python3 miner.py && cd web && npm run dev"
        );
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return {
    products,
    matches,
    matchesRevisar,
    oportunidades,
    resumo,
    loading,
    error,
  };
}
