export function buildProductUrl(fonte, id, sku) {
  const f = (fonte || "").toLowerCase();
  const pid = String(id || "").trim();
  if (!pid) return null;

  if (f === "dropipro" || f === "dropi") {
    return `https://dropipro.com/app/products/${pid}`;
  }
  if (f === "ecomhub") {
    return `https://app.ecomhub.app/products/${pid}`;
  }
  return null;
}

export function enrichProduct(p) {
  const fonte = p.fonte;
  return {
    fonte,
    id: String(p.id),
    nome: p.nome,
    sku: p.sku || null,
    preco_eur: Number(p.preco_eur),
    stock: Number(p.stock),
    imagem: p.imagem || null,
    plataforma: fonte === "dropipro" ? "Dropi PRO" : "EcomHub",
  };
}
