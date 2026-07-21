export type ExchangeRateType = 'buy' | 'sell' | 'reference' | 'custom';

export interface ExchangeRateRequest {
  sourceCurrency: string;
  targetCurrency: string;
  effectiveAt: Date;
  rateType?: ExchangeRateType;
}

export type ExchangeRateEvidenceLegRole = 'source' | 'target';

export interface ExchangeRateEvidenceLeg {
  role: ExchangeRateEvidenceLegRole;
  currency: string;
  economy: string | null;
  value: string;
  sourceUrl?: string;
}

export interface ExchangeRateEvidence {
  source: string;
  indicator: string;
  observationPeriod: string;
  legs: readonly ExchangeRateEvidenceLeg[];
}

export interface ExchangeRateQuote {
  sourceCurrency: string;
  targetCurrency: string;
  rate: number;
  rateType: ExchangeRateType;
  effectiveAt: Date;
  retrievedAt: Date;
  provider: string;
  sourceUrl?: string;
  evidence?: ExchangeRateEvidence;
}

export interface CurrencyConversionMetadata extends ExchangeRateQuote {
  originalPayableAmount: number;
  convertedPayableAmount: number;
}

export interface ExchangeRateProvider {
  getQuote(request: ExchangeRateRequest): Promise<ExchangeRateQuote>;
}
