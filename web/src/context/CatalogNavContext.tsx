import { createContext, useContext, type ReactNode } from "react";

type OpenInCatalog = (fonte: string, id: string) => void;

const CatalogNavContext = createContext<OpenInCatalog | null>(null);

export function CatalogNavProvider({
  children,
  onOpenInCatalog,
}: {
  children: ReactNode;
  onOpenInCatalog: OpenInCatalog;
}) {
  return (
    <CatalogNavContext.Provider value={onOpenInCatalog}>
      {children}
    </CatalogNavContext.Provider>
  );
}

export function useCatalogNav() {
  return useContext(CatalogNavContext);
}
