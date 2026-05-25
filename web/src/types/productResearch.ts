/**
 * Tipos partilhados para pesquisa de produto / mineração (frontend + contratos API).
 */

export type MiningRecommendation = "TESTAR" | "ESCALAR" | "EVITAR";

export interface ProductResearchScore {
  score: number;
  trendScore: number;
  marginScore: number;
  saturationScore: number;
  viralScore: number;
  logisticsScore: number;
  categoryScore?: number;
  growthScore?: number;
  competitionPenalty?: number;
  recommendation: MiningRecommendation;
  risks: string[];
  positives: string[];
  suggestedPrice: number;
  trendDataAvailable?: boolean;
}

export interface GoogleTrendsPoint {
  date: string;
  value: number;
}

export interface GoogleTrendsRelatedQuery {
  query: string;
  value: number;
}

/** Payload normalizado devolvido pelo `googleTrendsService` / CLI Python */
export interface GoogleTrendsNormalized {
  ok: boolean;
  source?: string;
  keyword?: string;
  geo?: string;
  timeframe?: string;
  interestOverTime?: GoogleTrendsPoint[];
  interestAvg?: number;
  interestLatest?: number;
  momentum?: number;
  relatedQueriesTop?: GoogleTrendsRelatedQuery[];
  relatedQueriesRising?: GoogleTrendsRelatedQuery[];
  error?: string;
  hint?: string;
}

export interface ExternalSignal {
  platform: string;
  signalStrength: number;
  notes: string[];
}

export interface ExternalSignalsBundle {
  source: string;
  tiktok: ExternalSignal;
  meta: ExternalSignal;
  amazon: ExternalSignal;
  aliexpress: ExternalSignal;
  shopee: ExternalSignal;
}

export interface ProductMiningAnalysisPayload {
  produto: Record<string, unknown>;
  keywordTrend: string;
  geo: string;
  trends: GoogleTrendsNormalized;
  externalSignals: ExternalSignalsBundle;
  score: ProductResearchScore;
}
