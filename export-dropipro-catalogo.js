/**
 * Exportar catálogo Dropi PRO (dropipro.com)
 *
 * COMO USAR:
 * 1. Faça login em https://dropipro.com/app/products
 * 2. Abra DevTools (F12) → Console
 * 3. Cole TODO este arquivo e pressione Enter
 * 4. Aguarde (~74 páginas, alguns minutos)
 * 5. Baixa automaticamente: dropipro-catalogo.csv e dropipro-catalogo.json
 *
 * Opcional: incluir SKU/descrição (mais lento):
 *   exportDropiCatalog({ fetchDetails: true, delayMs: 400 })
 */

async function exportDropiCatalog(options = {}) {
  const {
    fetchDetails = false,
    delayMs = 350,
    maxPages = null,
  } = options;

  const baseUrl = "https://dropipro.com/app/products";
  const csrf =
    document.querySelector('meta[name="csrf-token"]')?.content ||
    document.querySelector('input[name="_token"]')?.value;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function parseProductsFromHtml(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const byId = new Map();

    doc.querySelectorAll('[onclick*="create_order"]').forEach((el) => {
      const onclick = el.getAttribute("onclick") || "";
      const m = onclick.match(
        /create_order\s*\(\s*event\s*,\s*(\d+)\s*,\s*'((?:\\'|[^'])*)'\s*,\s*(\d+)\s*,\s*'([^']*)'\s*,\s*'([^']*)'/
      );
      if (!m) return;
      const id = m[1];
      byId.set(id, {
        id,
        nome: m[2].replace(/\\'/g, "'"),
        stock: Number(m[3]),
        peso_kg: m[4],
        preco_eur: m[5],
        imagem: "",
        sku: "",
        categoria: "",
      });
    });

    doc.querySelectorAll(".btn_view_product[data-id]").forEach((btn) => {
      const id = btn.dataset.id;
      const p = byId.get(id);
      if (!p) return;
      const card = btn.closest(".inventory-section-item");
      const img = card?.querySelector("img");
      if (img?.src) {
        p.imagem = img.src.startsWith("http")
          ? img.src
          : "https://dropipro.com" + img.getAttribute("src");
      }
    });

    let lastPage = 1;
    doc.querySelectorAll('.pagination a[href*="page="]').forEach((a) => {
      const pm = a.href.match(/page=(\d+)/);
      if (pm) lastPage = Math.max(lastPage, Number(pm[1]));
    });

    return { products: [...byId.values()], lastPage };
  }

  async function fetchProductDetail(id) {
    const body = new URLSearchParams({ id });
    const headers = { "Content-Type": "application/x-www-form-urlencoded" };
    if (csrf) headers["X-CSRF-TOKEN"] = csrf;

    const res = await fetch("https://dropipro.com/ajax/products/view", {
      method: "POST",
      credentials: "include",
      headers,
      body,
    });
    if (!res.ok) return {};
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const text = doc.body?.textContent || "";

    const sku =
      text.match(/SKU[:\s]+([^\n]+)/i)?.[1]?.trim() ||
      doc.querySelector("[class*='sku' i]")?.textContent?.trim() ||
      "";

    return { sku };
  }

  const all = [];
  let page = 1;
  let lastPage = 1;

  console.log("Iniciando exportação Dropi PRO…");

  do {
    const url = page === 1 ? baseUrl : `${baseUrl}?page=${page}`;
    console.log(`Página ${page}/${lastPage}…`);

    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
      console.error(`Erro HTTP ${res.status} na página ${page}`);
      break;
    }

    const { products, lastPage: detected } = parseProductsFromHtml(
      await res.text()
    );
    lastPage = detected;
    all.push(...products);
    console.log(`  +${products.length} produtos (total: ${all.length})`);

    if (maxPages && page >= maxPages) break;
    page++;
    await sleep(delayMs);
  } while (page <= lastPage);

  if (fetchDetails && all.length) {
    console.log(`Buscando detalhes (SKU) de ${all.length} produtos…`);
    for (let i = 0; i < all.length; i++) {
      const p = all[i];
      if (i % 20 === 0) console.log(`  detalhe ${i + 1}/${all.length}`);
      try {
        const extra = await fetchProductDetail(p.id);
        if (extra.sku) p.sku = extra.sku;
      } catch (_) {}
      await sleep(delayMs);
    }
  }

  const csvEscape = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const cols = ["id", "nome", "stock", "peso_kg", "preco_eur", "imagem", "sku"];
  const csv =
    cols.join(",") +
    "\n" +
    all.map((p) => cols.map((c) => csvEscape(p[c])).join(",")).join("\n");

  const download = (filename, content, mime) => {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  download(
    "dropipro-catalogo.csv",
    "\uFEFF" + csv,
    "text/csv;charset=utf-8"
  );
  download(
    "dropipro-catalogo.json",
    JSON.stringify(all, null, 2),
    "application/json"
  );

  console.log(`Concluído: ${all.length} produtos exportados.`);
  return all;
}

// Descomente para rodar ao colar:
// exportDropiCatalog();
