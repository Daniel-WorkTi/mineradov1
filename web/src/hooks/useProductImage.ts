import { useCallback, useMemo, useState } from "react";
import type { Fonte } from "../types";
import { imageCandidates } from "../utils";

export function useProductImage(
  imagem: string,
  fonte: Fonte,
  nome: string
) {
  const candidates = useMemo(
    () => imageCandidates(imagem, fonte, nome),
    [imagem, fonte, nome]
  );

  const [index, setIndex] = useState(0);
  const src = candidates[Math.min(index, candidates.length - 1)] ?? "";
  const isPlaceholder = index >= candidates.length - 1 && candidates.length > 0;

  const onError = useCallback(() => {
    setIndex((i) => (i + 1 < candidates.length ? i + 1 : i));
  }, [candidates.length]);

  return { src, onError, isPlaceholder, candidates };
}
