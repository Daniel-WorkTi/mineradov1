/**
 * Score 0–100 + breakdown para o ProductMiningAgent.
 * Combina tendência (quando disponível), dados do catálogo e sinais externos (mock).
 */

/** @param {unknown} v */
function num(v) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/**
 * @param {{
 *   product: Record<string, unknown>;
 *   trends: Record<string, unknown> | null;
 *   external: Record<string, unknown> | null;
 * }} input
 */
export function computeProductResearchScore(input) {
  const p = input.product;
  const trends = input.trends || {};
  const ext = input.external || {};

  const preco = num(p.preco_eur);
  const stock = num(p.stock);
  const scoreMiner = num(p.score_minerado);
  const tags = String(p.tags || "").toLowerCase();
  const peso = num(p.peso);
  const envio = num(p.envio_eur);

  const trendOk = Boolean(trends?.ok);
  const momentum = num(trends.momentum);
  const interestAvg = num(trends.interestAvg);
  const interestLatest = num(trends.interestLatest);
  const risingN = Array.isArray(trends.relatedQueriesRising)
    ? trends.relatedQueriesRising.length
    : 0;

  let trendScore = 40;
  if (trendOk) {
    trendScore = Math.min(
      100,
      Math.round(
        interestAvg * 0.35 +
          interestLatest * 0.25 +
          Math.max(0, momentum) * 8 +
          risingN * 3
      )
    );
  } else {
    trendScore = Math.min(85, Math.round(35 + scoreMiner * 1.2 + (tags.includes("winner") ? 15 : 0)));
  }

  const marginScore = Math.min(
    100,
    Math.round(
      Math.min(preco > 0 ? 55 - Math.min(preco, 40) : 30, 55) +
        (tags.includes("oportunidade") || tags.includes("margem") ? 20 : 0) +
        (tags.includes("winner_candidate") ? 15 : 0)
    )
  );

  const saturationScore = Math.min(
    100,
    Math.round(
      25 +
        (stock > 5000 ? 25 : stock > 1500 ? 15 : 5) +
        (trendOk && momentum < -5 ? 20 : 0) +
        (ext?.amazon?.signalStrength > 70 ? 15 : 0)
    )
  );

  const viralScore = Math.min(
    100,
    Math.round(
      (trendOk && risingN >= 3 ? 35 : 15) +
        (tags.includes("winner") ? 25 : 0) +
        (ext?.tiktok?.signalStrength ? ext.tiktok.signalStrength * 0.35 : 10)
    )
  );

  const logisticsScore = Math.min(
    100,
    Math.round(70 - Math.min(peso * 12, 35) - (envio > 4 ? 15 : envio > 2 ? 8 : 0))
  );

  const categoryScore = Math.min(
    100,
    Math.round(45 + (tags ? tags.split(",").filter(Boolean).length * 5 : 0))
  );

  const competitionPenalty = ext?.meta?.signalStrength
    ? Math.min(30, ext.meta.signalStrength * 0.25)
    : 10;
  const growthScore = trendOk ? Math.min(100, 50 + momentum * 5 + risingN * 2) : 50;

  const score = Math.round(
    trendScore * 0.22 +
      marginScore * 0.18 +
      (100 - saturationScore) * 0.14 +
      viralScore * 0.12 +
      logisticsScore * 0.1 +
      categoryScore * 0.08 +
      growthScore * 0.1 -
      competitionPenalty * 0.06
  );
  const clamped = Math.max(0, Math.min(100, score));

  let recommendation = "TESTAR";
  if (clamped >= 72 && saturationScore < 60) recommendation = "ESCALAR";
  if (clamped < 42 || saturationScore >= 78) recommendation = "EVITAR";

  const risks = [];
  const positives = [];

  if (saturationScore >= 65) risks.push("Stock alto ou sinais de saturação no catálogo / mercado.");
  if (!trendOk) risks.push("Tendência Google indisponível — parte do score usa heurísticas do catálogo.");
  if (preco < 1) risks.push("Preço muito baixo pode comprimir margem após envio e taxas.");
  if (peso > 1.5) risks.push("Peso elevado — custo de envio e devoluções.");

  if (tags.includes("winner_candidate")) positives.push("Tag winner_candidate no minerador.");
  if (tags.includes("dropi_baixo_ecom_alto")) positives.push("Oportunidade de stock Dropi↔EcomHub.");
  if (trendOk && momentum > 2) positives.push("Momentum positivo nas pesquisas Google (período recente).");
  if (trendOk && risingN >= 2) positives.push("Queries relacionadas em crescimento.");

  const suggestedPrice =
    preco > 0 ? Math.round((preco * (recommendation === "ESCALAR" ? 1.35 : 1.22) + Number.EPSILON) * 100) / 100 : 0;

  return {
    score: clamped,
    trendScore: Math.round(trendScore),
    marginScore: Math.round(marginScore),
    saturationScore: Math.round(saturationScore),
    viralScore: Math.round(viralScore),
    logisticsScore: Math.round(logisticsScore),
    categoryScore: Math.round(categoryScore),
    growthScore: Math.round(growthScore),
    competitionPenalty: Math.round(competitionPenalty),
    recommendation,
    risks,
    positives,
    suggestedPrice,
    trendDataAvailable: trendOk,
  };
}
