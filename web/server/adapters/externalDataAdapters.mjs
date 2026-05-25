/**
 * Adapters externos (TikTok, Meta, Amazon, AliExpress, Shopee).
 * Hoje: mocks estáveis; substituir por HTTP reais quando houver credenciais.
 */

/** @typedef {{ platform: string; signalStrength: number; notes: string[] }} ExternalSignal */

/**
 * @param {string} keyword
 * @returns {Promise<ExternalSignal>}
 */
export async function fetchTikTokCreativeMock(keyword) {
  return {
    platform: "tiktok_creative_center",
    signalStrength: 42,
    notes: [
      `Mock TikTok: volume criativo estimado para "${keyword.slice(0, 40)}".`,
      "Integração futura: API / export manual do Creative Center.",
    ],
  };
}

export async function fetchMetaAdsLibraryMock(keyword) {
  return {
    platform: "meta_ads",
    signalStrength: 38,
    notes: [
      `Mock Meta: concorrência anúncios aproximada para "${keyword.slice(0, 40)}".`,
      "Integração futura: Marketing API com token.",
    ],
  };
}

export async function fetchAmazonMock(keyword) {
  return {
    platform: "amazon",
    signalStrength: 55,
    notes: [
      `Mock Amazon: procura de categoria para "${keyword.slice(0, 40)}".`,
      "Integração futura: PA-API ou scraping controlado.",
    ],
  };
}

export async function fetchAliExpressMock(keyword) {
  return {
    platform: "aliexpress",
    signalStrength: 48,
    notes: [
      "Mock AliExpress: oferta de SKUs semelhantes elevada.",
      "Integração futura: DS API / parceiros.",
    ],
  };
}

export async function fetchShopeeMock(keyword) {
  return {
    platform: "shopee",
    signalStrength: 35,
    notes: [
      "Mock Shopee: relevância regional (ES/PT).",
      "Integração futura: Shopee Open Platform.",
    ],
  };
}

/**
 * Agrega todos os mocks num único objeto para o LLM / scoring.
 * @param {string} keyword
 */
export async function gatherExternalSignals(keyword) {
  const [tiktok, meta, amazon, ali, shopee] = await Promise.all([
    fetchTikTokCreativeMock(keyword),
    fetchMetaAdsLibraryMock(keyword),
    fetchAmazonMock(keyword),
    fetchAliExpressMock(keyword),
    fetchShopeeMock(keyword),
  ]);
  return { tiktok, meta, amazon, aliexpress: ali, shopee, source: "mock_adapters" };
}
