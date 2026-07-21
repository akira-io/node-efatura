import { Buffer } from 'node:buffer';
import { type CheerioAPI, load } from 'cheerio';
import Decimal from 'decimal.js';
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

type TableRow = string[];

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
    this.#sourceUrl = options.sourceUrl ?? DEFAULT_BCV_SOURCE_URL;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
    this.#allowPreviousPublication = options.allowPreviousPublication ?? false;
    this.#maxPublicationAgeDays = options.maxPublicationAgeDays ?? 0;
  }

  async getQuote(request: ExchangeRateRequest): Promise<ExchangeRateQuote> {
    const sourceCurrency = normalizeCurrencyCode(request.sourceCurrency);
    const targetCurrency = normalizeCurrencyCode(request.targetCurrency);
    const rateType = request.rateType ?? 'buy';

    assertSupportedRequest(targetCurrency, rateType);

    const html = await this.#fetchHtml();
    const $ = load(html);
    const publicationDate = parsePublicationDate($);
    this.#assertPublicationDate(request.effectiveAt, publicationDate);
    const rate = parseRate($, sourceCurrency, rateType);

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
    } catch (cause) {
      throw providerUnavailable(undefined, cause);
    }

    if (!response.ok) {
      throw providerUnavailable(response.status);
    }

    let html: string;

    try {
      html = await response.text();
    } catch (cause) {
      throw providerUnavailable(undefined, cause);
    }

    if (Buffer.byteLength(html, 'utf8') > this.#maxResponseBytes) {
      throw invalidBcvResponse('response size exceeds the configured limit');
    }

    return html;
  }

  #assertPublicationDate(requestedAt: Date, publicationDate: Date): void {
    const requestedDay = utcCalendarDay(requestedAt);
    const publishedDay = utcCalendarDay(publicationDate);
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

function parsePublicationDate($: CheerioAPI): Date {
  const text = $.root().text().replaceAll('\u00a0', ' ');
  const dateMatch = text.match(/Taxas de Câmbio para o dia\s+(\d{2})\/(\d{2})\/(\d{4})/i);

  if (!dateMatch) {
    throw invalidBcvResponse('publication date is missing');
  }

  const [, dayText, monthText, yearText] = dateMatch;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const publicationDate = new Date(Date.UTC(year, month - 1, day));

  if (
    publicationDate.getUTCFullYear() !== year ||
    publicationDate.getUTCMonth() !== month - 1 ||
    publicationDate.getUTCDate() !== day
  ) {
    throw invalidBcvResponse('publication date is invalid');
  }

  return publicationDate;
}

function parseRate($: CheerioAPI, sourceCurrency: string, rateType: 'buy' | 'sell'): number {
  for (const table of $('table').toArray()) {
    const rows = $(table)
      .find('tr')
      .toArray()
      .map((element) =>
        $(element)
          .find('th,td')
          .toArray()
          .map((cell) => $(cell).text().trim()),
      );
    const headerIndex = rows.findIndex((row) => row.some((cell) => headerName(cell) === 'MOEDA'));

    if (headerIndex < 0) {
      continue;
    }

    const headers = rows[headerIndex]?.map(headerName) ?? [];
    const requiredHeaders = ['PAIS', 'MOEDA', 'UNIDADES', 'COMPRA', 'VENDA'];

    if (requiredHeaders.some((header) => !headers.includes(header))) {
      throw invalidBcvResponse('required rate table columns are missing');
    }

    const currencyIndex = headers.indexOf('MOEDA');
    const unitsIndex = headers.indexOf('UNIDADES');
    const rateIndex = headers.indexOf(rateType === 'buy' ? 'COMPRA' : 'VENDA');
    const row = findCurrencyRow(rows.slice(headerIndex + 1), currencyIndex, sourceCurrency);

    if (!row) {
      throw new ExchangeRateError(
        'exchange_rate.currency_unsupported',
        `BCV did not publish a rate for ${sourceCurrency}.`,
      );
    }

    return normalizePublishedRate(row[rateIndex], row[unitsIndex]);
  }

  throw invalidBcvResponse('rate table is missing');
}

function findCurrencyRow(
  rows: TableRow[],
  currencyIndex: number,
  sourceCurrency: string,
): TableRow | undefined {
  return rows.find((row) => normalizeCurrencyCode(row[currencyIndex] ?? '') === sourceCurrency);
}

function normalizePublishedRate(
  rateText: string | undefined,
  unitsText: string | undefined,
): number {
  try {
    const rate = parseLocalizedDecimal(rateText);
    const units = parseLocalizedDecimal(unitsText);

    if (!rate.isFinite() || !units.isFinite() || rate.lte(0) || units.lte(0)) {
      throw new Error('BCV rate and units must be positive finite numbers.');
    }

    return rate.dividedBy(units).toNumber();
  } catch (cause) {
    throw new ExchangeRateError(
      'exchange_rate.rate_invalid',
      'The BCV rate or unit count is invalid.',
      { cause },
    );
  }
}

function parseLocalizedDecimal(value: string | undefined): Decimal {
  if (value === undefined || value.trim().length === 0) {
    throw new Error('A localized decimal value is missing.');
  }

  return new Decimal(value.replace(/[ \u00a0]/g, '').replace(',', '.'));
}

function headerName(value: string): string {
  return value
    .replaceAll('\u00a0', ' ')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function utcCalendarDay(value: Date): number {
  const timestamp = value instanceof Date ? value.getTime() : Number.NaN;

  if (!Number.isFinite(timestamp)) {
    throw new ExchangeRateError(
      'exchange_rate.date_invalid',
      'The requested exchange-rate date is invalid.',
    );
  }

  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function providerUnavailable(status?: number, cause?: unknown): ExchangeRateError {
  const statusSuffix = status === undefined ? '' : ` (HTTP ${status})`;

  return new ExchangeRateError(
    'exchange_rate.provider_unavailable',
    `The BCV exchange-rate source is unavailable${statusSuffix}.`,
    { cause },
  );
}

function invalidBcvResponse(detail: string): ExchangeRateError {
  return new ExchangeRateError(
    'exchange_rate.response_invalid',
    `The BCV exchange-rate response is invalid: ${detail}.`,
  );
}
