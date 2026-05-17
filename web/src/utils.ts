import type { Fonte, Product } from "./types";

/** Hosts onde o EcomHub pode servir imagens (tenta em ordem). */
const ECOMHUB_HOSTS = [
  "https://api.ecomhub.app",
  "https://app.ecomhub.app",
  "https://ecomhub.app",
];

const DROPI_HOST = "https://dropipro.com";

export function parseNum(value: string | number | undefined): number {
  if (value === undefined || value === "") return 0;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function formatEuro(value: string | number): string {
  const n = typeof value === "string" ? parseNum(value) : value;
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

/** Lista de URLs para tentar carregar (CDN real → placeholder com nome). */
export function imageCandidates(
  imagem: string,
  fonte: Fonte,
  nome = ""
): string[] {
  const out: string[] = [];

  if (imagem?.trim()) {
    if (imagem.startsWith("http")) {
      out.push(imagem);
      // Se veio api.ecomhub.app e falhar, tenta outros hosts com o mesmo path
      if (fonte === "ecomhub") {
        try {
          const path = new URL(imagem).pathname;
          for (const host of ECOMHUB_HOSTS) {
            out.push(`${host}${path}`);
          }
        } catch {
          /* URL inválida */
        }
      }
    } else if (fonte === "ecomhub") {
      const path = imagem.startsWith("/") ? imagem : `/${imagem}`;
      for (const host of ECOMHUB_HOSTS) {
        out.push(`${host}${path}`);
      }
    } else {
      out.push(
        imagem.startsWith("/") ? `${DROPI_HOST}${imagem}` : imagem
      );
    }
  }

  out.push(placeholderImage(nome, fonte));
  return [...new Set(out)];
}

/** Placeholder gratuito (UI Avatars) — sem API key, usa nome do produto. */
export function placeholderImage(nome: string, fonte: Fonte): string {
  const bg = fonte === "dropipro" ? "ea580c" : "2563eb";
  const label =
    nome.trim().slice(0, 28) ||
    (fonte === "dropipro" ? "Dropi PRO" : "EcomHub");
  const params = new URLSearchParams({
    name: label,
    size: "400",
    background: bg,
    color: "ffffff",
    bold: "true",
    format: "png",
  });
  return `https://ui-avatars.com/api/?${params.toString()}`;
}

export function imageUrl(imagem: string, fonte: Fonte): string {
  return imageCandidates(imagem, fonte)[0] ?? "";
}

export function productImage(p: Product): string {
  return imageCandidates(p.imagem, p.fonte, p.nome)[0] ?? "";
}

export function stockLabel(stock: string): {
  text: string;
  color: "success" | "warning" | "danger";
} {
  const n = parseNum(stock);
  if (n >= 500)
    return { text: `${n.toLocaleString("pt-PT")} em stock`, color: "success" };
  if (n >= 50)
    return { text: `${n.toLocaleString("pt-PT")} em stock`, color: "warning" };
  return { text: `${n.toLocaleString("pt-PT")} em stock`, color: "danger" };
}
