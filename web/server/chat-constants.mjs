/** Máximo de cards clicáveis por resposta no chat. */
export const CHAT_MAX_PRODUCTS = 5;

/** Quando o utilizador pede produtos mas sem número, mostramos poucos cards. */
export const DEFAULT_PRODUCT_COUNT_WHEN_ASKED = 3;

/**
 * True se o utilizador pediu explicitamente sugestões/lista/cards de produtos.
 * Caso contrário o chat responde só em texto (sem cards).
 */
export function userWantsProductCards(message = "") {
  const raw = String(message).trim();
  if (!raw) return false;

  const text = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Só estatística / contagem — sem cards
  if (
    /^(quantos|quantas|cuantos|how many)\b/.test(text) &&
    !/\b(mostra|mostre|lista|listar|sugere|recomenda|envia|dame|da-me|compara)\b/.test(
      text
    )
  ) {
    return false;
  }

  // Número explícito de produtos / top N
  const countPatterns = [
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
  if (countPatterns.some((re) => re.test(text))) return true;

  // Pedido explícito de lista, recomendação ou cards no chat
  const intentPatterns = [
    /(sugere|recomenda|mostra|mostre|lista|listar|indica|apresenta|envia|d[aá][\s-]?me|quero\s+ver)\s+(alguns\s+)?(os\s+)?(produtos|op[cç][oõ]es|candidatos|exemplos)/,
    /quais?\s+(s[aã]o\s+)?(os\s+|as\s+|alguns\s+)?(melhores\s+)?produtos/,
    /(melhores|top)\s+produtos/,
    /(cards|cartoes|cartões)/,
    /(pesquisa|procura|busca)\s+(no\s+)?cat[aá]logo/,
    /procur(ar|a)\s+produtos/,
    /(mostra|mostre|d[aá])\s+(alguns\s+)?(itens|artigos)/,
    /oportunidades?\s+(de\s+)?(estoque|stock|miner)/,
    /lista(r)?\s+(as\s+|os\s+)?(oportunidades|matches)/,
    /(dá|da|envia)\s+(uma\s+)?(lista|sele[cç][aã]o)\s+(de\s+)?produtos/,
    /(alguns|uns)\s+produtos/,
    /sugest[aã]o(es)?\s+(de\s+)?produtos/,
    /produtos?\s+com\s+tend(encia|ência)/,
    /tend(encia|ência)\s+(crescente|alta|positiva)/,
  ];
  return intentPatterns.some((re) => re.test(text));
}

/** Quantos cards mostrar (0 = nenhum). */
export function getChatProductLimit(userMessage = "") {
  if (!userWantsProductCards(userMessage)) return 0;

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

  return DEFAULT_PRODUCT_COUNT_WHEN_ASKED;
}

export function limitChatProducts(products, userMessage = "") {
  const limit = getChatProductLimit(userMessage);
  if (limit < 1) return [];
  return products.slice(0, limit);
}
