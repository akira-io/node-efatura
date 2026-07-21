import type {
  ExchangeRateProvider,
  ExchangeRateQuote,
  ExchangeRateRequest,
  ExchangeRateType,
} from '../../core/contracts/exchange-rate-provider';
import {
  normalizeCurrencyCode,
  validateExchangeRateQuote,
} from '../../domain/currency/exchange-rate-quote';

export interface FixedExchangeRateProviderOptions {
  sourceCurrency: string;
  targetCurrency: string;
  rate: number;
  effectiveAt: Date;
  retrievedAt?: Date;
  rateType?: ExchangeRateType;
  provider: string;
  sourceUrl?: string;
}

export class FixedExchangeRateProvider implements ExchangeRateProvider {
  readonly #quote: ExchangeRateQuote;

  constructor(input: FixedExchangeRateProviderOptions) {
    const sourceCurrency = normalizeCurrencyCode(input.sourceCurrency);
    const targetCurrency = normalizeCurrencyCode(input.targetCurrency);
    const rateType = input.rateType ?? 'custom';
    const effectiveAt = input.effectiveAt;

    this.#quote = validateExchangeRateQuote(
      { sourceCurrency, targetCurrency, effectiveAt, rateType },
      {
        ...input,
        sourceCurrency,
        targetCurrency,
        rateType,
        retrievedAt: input.retrievedAt ?? effectiveAt,
      },
    );
  }

  async getQuote(request: ExchangeRateRequest): Promise<ExchangeRateQuote> {
    return validateExchangeRateQuote(request, this.#quote);
  }
}
