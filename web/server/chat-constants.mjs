/** Máximo de cards clicáveis por resposta no chat. */
export const CHAT_MAX_PRODUCTS = 5;

/** Quantos cards mostrar conforme o pedido do utilizador (máx. 5). */
export function getChatProductLimit(userMessage = "") {
  const text = String(userMessage).toLowerCase();
  const patterns = [
    /(\d+)\s*produtos?/,
    /mostre\s*(\d+)/,
    /me\s+mostre\s*(\d+)/,
    /sugere\s*(\d+)/,
    /lista\s*(\d+)/,
    /top\s*(\d+)/,
    /(\d+)\s*candidatos?/,
    /(\d+)\s*op[cç][oõ]es?/,
    /me\s+d[aá]\s*(\d+)/,
  ];

  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) {
      const n = Number.parseInt(m[1], 10);
      if (Number.isFinite(n) && n >= 1) {
        return Math.min(n, CHAT_MAX_PRODUCTS);
      }
    }
  }

  return CHAT_MAX_PRODUCTS;
}

export function limitChatProducts(products, userMessage = "") {
  const limit = getChatProductLimit(userMessage);
  return products.slice(0, limit);
}
