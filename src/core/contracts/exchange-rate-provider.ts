export type ExchangeRateType = 'buy' | 'sell' | 'reference' | 'custom';

export interface ExchangeRateRequest {
  sourceCurrency: string;
  targetCurrency: string;
  effectiveAt: Date;
  rateType?: ExchangeRateType;
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
}

export interface CurrencyConversionMetadata extends ExchangeRateQuote {
  originalPayableAmount: number;
  convertedPayableAmount: number;
}

export interface ExchangeRateProvider {
  getQuote(request: ExchangeRateRequest): Promise<ExchangeRateQuote>;
}
