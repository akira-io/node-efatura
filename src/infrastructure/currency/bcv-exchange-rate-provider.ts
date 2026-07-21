import type { Clock } from '../../core/contracts/clock';
import type {
  ExchangeRateProvider,
  ExchangeRateQuote,
  ExchangeRateRequest,
  ExchangeRateType,
} from '../../core/contracts/exchange-rate-provider';
import { ExchangeRateError } from '../../domain/currency/exchange-rate-error';
import {
  normalizeCurrencyCode,
  validateExchangeRateQuote,
} from '../../domain/currency/exchange-rate-quote';
import { SystemClock } from '../clock/system-clock';
import { parseBcvExchangeRateHtml } from './bcv-exchange-rate-parser';

export interface BcvExchangeRateProviderOptions {
  fetcher?: typeof fetch;
  clock?: Clock;
  sourceUrl?: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
  allowPreviousPublication?: boolean;
  maxPublicationAgeDays?: number;
}

const DEFAULT_BCV_SOURCE_URL =
  'https://www.bcv.cv/pt/PoliticaMonetaria/EstatisticasCambiais/Paginas/Estatisticas_Cambiais.aspx?_expType=PDF';
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESPONSE_BYTES = 1024 * 1024;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const PROVIDER_NAME = 'Banco de Cabo Verde';

export class BcvExchangeRateProvider implements ExchangeRateProvider {
  readonly #fetch: typeof fetch;
  readonly #clock: Clock;
  readonly #sourceUrl: string;
  readonly #timeoutMs: number;
  readonly #maxResponseBytes: number;
  readonly #allowPreviousPublication: boolean;
  readonly #maxPublicationAgeDays: number;

  constructor(options: BcvExchangeRateProviderOptions = {}) {
    this.#fetch = options.fetcher ?? fetch;
    this.#clock = options.clock ?? new SystemClock();
    this.#sourceUrl = normalizeSourceUrl(options.sourceUrl ?? DEFAULT_BCV_SOURCE_URL);
    this.#timeoutMs = positiveSafeInteger(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 'timeout');
    this.#maxResponseBytes = positiveSafeInteger(
      options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES,
      'response size limit',
    );
    this.#allowPreviousPublication = options.allowPreviousPublication ?? false;
    this.#maxPublicationAgeDays = nonnegativeSafeInteger(
      options.maxPublicationAgeDays ?? 0,
      'maximum publication age',
    );
  }

  async getQuote(request: ExchangeRateRequest): Promise<ExchangeRateQuote> {
    const sourceCurrency = normalizeCurrencyCode(request.sourceCurrency);
    const targetCurrency = normalizeCurrencyCode(request.targetCurrency);
    const rateType = request.rateType ?? 'buy';

    assertSupportedRequest(targetCurrency, rateType);

    const html = await this.#fetchHtml();
    const { publicationDate, rate } = parseBcvExchangeRateHtml(html, sourceCurrency, rateType);
    this.#assertPublicationDate(request.effectiveAt, publicationDate);

    return validateExchangeRateQuote(request, {
      sourceCurrency,
      targetCurrency,
      rate,
      rateType,
      effectiveAt: publicationDate,
      retrievedAt: this.#clock.now(),
      provider: PROVIDER_NAME,
      sourceUrl: this.#sourceUrl,
    });
  }

  async #fetchHtml(): Promise<string> {
    let response: Response;

    try {
      response = await this.#fetch(this.#sourceUrl, {
        headers: { accept: 'text/html' },
        signal: AbortSignal.timeout(this.#timeoutMs),
      });
    } catch {
      throw providerUnavailable();
    }

    if (!response.ok) {
      throw providerUnavailable(response.status);
    }

    try {
      return await readBoundedResponse(response, this.#maxResponseBytes);
    } catch (error) {
      if (error instanceof ExchangeRateError) {
        throw error;
      }

      throw providerUnavailable();
    }
  }

  #assertPublicationDate(requestedAt: Date, publicationDate: Date): void {
    const requestedDay = capeVerdeCalendarDay(requestedAt);
    const publishedDay = publicationDate.getTime();
    const ageDays = (requestedDay - publishedDay) / MILLISECONDS_PER_DAY;

    if (ageDays < 0) {
      throw new ExchangeRateError(
        'exchange_rate.date_invalid',
        'BCV returned a future publication.',
      );
    }

    if (ageDays > 0 && !this.#allowPreviousPublication) {
      throw new ExchangeRateError(
        'exchange_rate.date_unavailable',
        'The BCV publication does not match the requested date.',
      );
    }

    if (ageDays > this.#maxPublicationAgeDays) {
      throw new ExchangeRateError(
        'exchange_rate.stale',
        `The BCV publication is ${ageDays} days older than the requested date.`,
      );
    }
  }
}

function assertSupportedRequest(
  targetCurrency: string,
  rateType: ExchangeRateType,
): asserts rateType is 'buy' | 'sell' {
  if (targetCurrency !== 'CVE' || (rateType !== 'buy' && rateType !== 'sell')) {
    throw new ExchangeRateError(
      'exchange_rate.pair_mismatch',
      'BCV exchange rates support buy or sell quotes targeting CVE.',
    );
  }
}

function capeVerdeCalendarDay(value: Date): number {
  const timestamp = value instanceof Date ? value.getTime() : Number.NaN;

  if (!Number.isFinite(timestamp)) {
    throw new ExchangeRateError(
      'exchange_rate.date_invalid',
      'The requested exchange-rate date is invalid.',
    );
  }

  const capeVerdeInstant = new Date(timestamp - 60 * 60 * 1000);

  return Date.UTC(
    capeVerdeInstant.getUTCFullYear(),
    capeVerdeInstant.getUTCMonth(),
    capeVerdeInstant.getUTCDate(),
  );
}

function providerUnavailable(status?: number): ExchangeRateError {
  const statusSuffix = status === undefined ? '' : ` (HTTP ${status})`;

  return new ExchangeRateError(
    'exchange_rate.provider_unavailable',
    `The BCV exchange-rate source is unavailable${statusSuffix}.`,
  );
}

async function readBoundedResponse(response: Response, maxResponseBytes: number): Promise<string> {
  const contentLength = response.headers.get('content-length');

  if (
    contentLength !== null &&
    /^\d+$/.test(contentLength) &&
    BigInt(contentLength) > BigInt(maxResponseBytes)
  ) {
    throw invalidBcvResponse('response size exceeds the configured limit');
  }

  if (!response.body) {
    return '';
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const decodedChunks: string[] = [];
  let responseBytes = 0;

  while (true) {
    const chunk = await reader.read();

    if (chunk.done) {
      decodedChunks.push(decoder.decode());
      return decodedChunks.join('');
    }

    responseBytes += chunk.value.byteLength;

    if (responseBytes > maxResponseBytes) {
      await reader.cancel().catch(() => undefined);
      throw invalidBcvResponse('response size exceeds the configured limit');
    }

    decodedChunks.push(decoder.decode(chunk.value, { stream: true }));
  }
}

function normalizeSourceUrl(sourceUrl: string): string {
  try {
    const url = new URL(sourceUrl);

    if (url.protocol !== 'https:' || url.username.length > 0 || url.password.length > 0) {
      throw new Error('The BCV source URL must use HTTPS.');
    }

    return url.toString();
  } catch {
    throw new ExchangeRateError(
      'exchange_rate.source_required',
      'An HTTPS BCV exchange-rate source URL is required.',
    );
  }
}

function positiveSafeInteger(candidate: number, label: string): number {
  if (!Number.isSafeInteger(candidate) || candidate <= 0) {
    throw invalidBcvResponse(`${label} must be a positive safe integer`);
  }

  return candidate;
}

function nonnegativeSafeInteger(candidate: number, label: string): number {
  if (!Number.isSafeInteger(candidate) || candidate < 0) {
    throw invalidBcvResponse(`${label} must be a nonnegative safe integer`);
  }

  return candidate;
}

function invalidBcvResponse(detail: string): ExchangeRateError {
  return new ExchangeRateError(
    'exchange_rate.response_invalid',
    `The BCV exchange-rate response is invalid: ${detail}.`,
  );
}
