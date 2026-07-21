import Decimal from 'decimal.js';
import type { Clock } from '../../core/contracts/clock';
import type {
  ExchangeRateProvider,
  ExchangeRateQuote,
  ExchangeRateRequest,
} from '../../core/contracts/exchange-rate-provider';
import { ExchangeRateError } from '../../domain/currency/exchange-rate-error';
import {
  normalizeCurrencyCode,
  validateExchangeRateQuote,
} from '../../domain/currency/exchange-rate-quote';
import { SystemClock } from '../clock/system-clock';
import {
  invalidWorldBankResponse,
  parseWorldBankObservation,
  readBoundedWorldBankResponse,
} from './world-bank-exchange-rate-response';

export interface WorldBankExchangeRateProviderOptions {
  fetcher?: typeof fetch;
  clock?: Clock;
  economyByCurrency?: Readonly<Record<string, string>>;
  indicator?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

const DEFAULT_ECONOMY_BY_CURRENCY = { CVE: 'CPV' } as const;
const DEFAULT_INDICATOR = 'PA.NUS.FCRF';
const DEFAULT_BASE_URL = 'https://api.worldbank.org';
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESPONSE_BYTES = 1024 * 1024;

export class WorldBankExchangeRateProvider implements ExchangeRateProvider {
  readonly #fetch: typeof fetch;
  readonly #clock: Clock;
  readonly #economyByCurrency: Readonly<Record<string, string>>;
  readonly #indicator: string;
  readonly #baseUrl: string;
  readonly #timeoutMs: number;
  readonly #maxResponseBytes: number;
  readonly #indicatorUrl: string;

  constructor(options: WorldBankExchangeRateProviderOptions = {}) {
    this.#fetch = options.fetcher ?? fetch;
    this.#clock = options.clock ?? new SystemClock();
    this.#economyByCurrency = normalizeEconomyMapping(options.economyByCurrency);
    this.#indicator = normalizeIndicator(options.indicator ?? DEFAULT_INDICATOR);
    this.#baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL);
    this.#timeoutMs = positiveInteger(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 'timeout');
    this.#maxResponseBytes = positiveInteger(
      options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES,
      'response size limit',
    );
    this.#indicatorUrl = `https://data.worldbank.org/indicator/${encodeURIComponent(this.#indicator)}`;
  }

  async getQuote(request: ExchangeRateRequest): Promise<ExchangeRateQuote> {
    const sourceCurrency = normalizeCurrencyCode(request.sourceCurrency);
    const targetCurrency = normalizeCurrencyCode(request.targetCurrency);
    const rateType = request.rateType ?? 'reference';
    const year = observationYear(request.effectiveAt);

    if (rateType !== 'reference') {
      throw new ExchangeRateError(
        'exchange_rate.pair_mismatch',
        'World Bank exchange rates support reference quotes only.',
      );
    }

    this.#assertSupportedCurrency(sourceCurrency);
    this.#assertSupportedCurrency(targetCurrency);

    const [sourcePerUsd, targetPerUsd] = await Promise.all([
      this.#currencyPerUsd(sourceCurrency, year),
      this.#currencyPerUsd(targetCurrency, year),
    ]);
    const rate = targetPerUsd
      .div(sourcePerUsd)
      .toDecimalPlaces(5, Decimal.ROUND_HALF_UP)
      .toNumber();

    return validateExchangeRateQuote(request, {
      sourceCurrency,
      targetCurrency,
      rate,
      rateType: 'reference',
      effectiveAt: new Date(`${year}-01-01T00:00:00.000Z`),
      retrievedAt: this.#clock.now(),
      provider: `World Bank ${this.#indicator}`,
      sourceUrl: this.#indicatorUrl,
    });
  }

  #assertSupportedCurrency(currency: string): void {
    if (currency !== 'USD' && !this.#economyByCurrency[currency]) {
      throw new ExchangeRateError(
        'exchange_rate.currency_unsupported',
        `A World Bank economy mapping is required for ${currency}.`,
      );
    }
  }

  async #currencyPerUsd(currency: string, year: number): Promise<Decimal> {
    if (currency === 'USD') {
      return new Decimal(1);
    }

    const economy = this.#economyByCurrency[currency];

    if (!economy) {
      throw new ExchangeRateError(
        'exchange_rate.currency_unsupported',
        `A World Bank economy mapping is required for ${currency}.`,
      );
    }

    const endpointUrl = new URL(
      `/v2/country/${encodeURIComponent(economy)}/indicator/${encodeURIComponent(this.#indicator)}`,
      this.#baseUrl,
    );
    endpointUrl.searchParams.set('format', 'json');
    endpointUrl.searchParams.set('date', String(year));
    endpointUrl.searchParams.set('per_page', '1');

    const worldBankPayload = await this.#fetchWorldBankJson(endpointUrl);
    return parseWorldBankObservation(worldBankPayload, economy, this.#indicator, year);
  }

  async #fetchWorldBankJson(endpointUrl: URL): Promise<unknown> {
    let httpResponse: Response;

    try {
      httpResponse = await this.#fetch(endpointUrl, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(this.#timeoutMs),
      });
    } catch (cause) {
      throw providerUnavailable(undefined, cause);
    }

    if (!httpResponse.ok) {
      throw providerUnavailable(httpResponse.status);
    }

    const responseBody = await readBoundedWorldBankResponse(httpResponse, this.#maxResponseBytes);

    try {
      return JSON.parse(responseBody);
    } catch (cause) {
      throw invalidWorldBankResponse('response body is not valid JSON', cause);
    }
  }
}

function normalizeEconomyMapping(
  configuredEconomies: Readonly<Record<string, string>> | undefined,
): Readonly<Record<string, string>> {
  const normalizedMapping: Record<string, string> = { ...DEFAULT_ECONOMY_BY_CURRENCY };

  for (const [currency, economy] of Object.entries(configuredEconomies ?? {})) {
    const currencyCode = normalizeCurrencyCode(currency);
    const economyCode = economy.trim().toUpperCase();

    if (currencyCode.length === 0 || economyCode.length === 0) {
      throw invalidWorldBankResponse(
        'economy mappings must contain non-empty currency and economy codes',
      );
    }

    normalizedMapping[currencyCode] = economyCode;
  }

  return normalizedMapping;
}

function normalizeIndicator(indicator: string): string {
  const normalized = indicator.trim();

  if (normalized.length === 0) {
    throw invalidWorldBankResponse('indicator must not be empty');
  }

  return normalized;
}

function normalizeBaseUrl(baseUrl: string): string {
  try {
    const parsedBaseUrl = new URL(baseUrl);

    if (parsedBaseUrl.protocol !== 'https:') {
      throw new Error('The World Bank base URL must use HTTPS.');
    }

    return parsedBaseUrl.toString();
  } catch (cause) {
    throw new ExchangeRateError(
      'exchange_rate.source_required',
      'An HTTPS World Bank base URL is required.',
      { cause },
    );
  }
}

function positiveInteger(candidate: number, label: string): number {
  if (!Number.isSafeInteger(candidate) || candidate <= 0) {
    throw invalidWorldBankResponse(`${label} must be a positive integer`);
  }

  return candidate;
}

function observationYear(effectiveAt: Date): number {
  const timestamp = effectiveAt instanceof Date ? effectiveAt.getTime() : Number.NaN;

  if (!Number.isFinite(timestamp)) {
    throw new ExchangeRateError(
      'exchange_rate.date_invalid',
      'The requested exchange-rate date is invalid.',
    );
  }

  return effectiveAt.getUTCFullYear();
}

function providerUnavailable(status?: number, cause?: unknown): ExchangeRateError {
  const statusSuffix = status === undefined ? '' : ` (HTTP ${status})`;

  return new ExchangeRateError(
    'exchange_rate.provider_unavailable',
    `The World Bank exchange-rate source is unavailable${statusSuffix}.`,
    { cause },
  );
}
