import Decimal from 'decimal.js';
import type {
  ExchangeRateQuote,
  ExchangeRateRequest,
  ExchangeRateType,
} from '../../core/contracts/exchange-rate-provider';
import { ExchangeRateError } from './exchange-rate-error';

const RATE_TYPES: readonly ExchangeRateType[] = ['buy', 'sell', 'reference', 'custom'];

export function normalizeCurrencyCode(currencyCode: string): string {
  return currencyCode.trim().toUpperCase();
}

export function validateExchangeRateQuote(
  request: ExchangeRateRequest,
  quote: ExchangeRateQuote,
): ExchangeRateQuote {
  const sourceCurrency = normalizeCurrencyCode(quote.sourceCurrency);
  const targetCurrency = normalizeCurrencyCode(quote.targetCurrency);

  if (!isExchangeRateType(quote.rateType)) {
    throw new ExchangeRateError(
      'exchange_rate.response_invalid',
      'The exchange-rate type is invalid.',
    );
  }

  if (
    sourceCurrency !== normalizeCurrencyCode(request.sourceCurrency) ||
    targetCurrency !== normalizeCurrencyCode(request.targetCurrency) ||
    (request.rateType !== undefined && quote.rateType !== request.rateType)
  ) {
    throw new ExchangeRateError(
      'exchange_rate.pair_mismatch',
      'The exchange-rate quote does not match the request.',
    );
  }

  const effectiveAt = validateDate(quote.effectiveAt, 'effective date');
  const retrievedAt = validateDate(quote.retrievedAt, 'retrieval date');
  const requestedEffectiveAt = validateDate(request.effectiveAt, 'requested effective date');

  if (effectiveAt > requestedEffectiveAt) {
    throw new ExchangeRateError(
      'exchange_rate.date_unavailable',
      'The exchange-rate quote is not available for the requested effective date.',
    );
  }

  if (quote.provider.trim().length === 0) {
    throw new ExchangeRateError(
      'exchange_rate.response_invalid',
      'The exchange-rate provider is required.',
    );
  }

  const sourceUrl = validateSourceUrl(quote.sourceUrl);
  const rate = normalizeRate(quote.rate);

  return {
    ...quote,
    sourceCurrency,
    targetCurrency,
    rate,
    effectiveAt: new Date(effectiveAt),
    retrievedAt: new Date(retrievedAt),
    sourceUrl,
  };
}

function validateDate(value: Date, label: string): number {
  const timestamp = value instanceof Date ? value.getTime() : Number.NaN;

  if (!Number.isFinite(timestamp)) {
    throw new ExchangeRateError(
      'exchange_rate.date_invalid',
      `The exchange-rate ${label} is invalid.`,
    );
  }

  return timestamp;
}

function validateSourceUrl(sourceUrl: string | undefined): string | undefined {
  if (sourceUrl === undefined) {
    return undefined;
  }

  if (sourceUrl.trim().length === 0) {
    throw new ExchangeRateError(
      'exchange_rate.source_required',
      'An HTTPS exchange-rate source URL is required.',
    );
  }

  try {
    const url = new URL(sourceUrl);

    if (url.protocol !== 'https:') {
      throw new Error('The source URL must use HTTPS.');
    }

    return url.toString();
  } catch (cause) {
    throw new ExchangeRateError(
      'exchange_rate.source_required',
      'An HTTPS exchange-rate source URL is required.',
      { cause },
    );
  }
}

function normalizeRate(rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new ExchangeRateError(
      'exchange_rate.rate_invalid',
      'The exchange rate must be a positive finite number.',
    );
  }

  const normalizedRate = new Decimal(rate.toString())
    .toDecimalPlaces(5, Decimal.ROUND_HALF_UP)
    .toNumber();

  if (normalizedRate <= 0) {
    throw new ExchangeRateError('exchange_rate.rate_invalid', 'The exchange rate rounds to zero.');
  }

  return normalizedRate;
}

function isExchangeRateType(value: unknown): value is ExchangeRateType {
  return typeof value === 'string' && RATE_TYPES.includes(value as ExchangeRateType);
}
