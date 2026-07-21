import { type Cheerio, type CheerioAPI, load } from 'cheerio';
import Decimal from 'decimal.js';
import type { Element } from 'domhandler';
import { ExchangeRateError } from '../../domain/currency/exchange-rate-error';
import { normalizeCurrencyCode } from '../../domain/currency/exchange-rate-quote';

interface BcvRateTable {
  element: Element;
  rows: string[][];
  headerIndex: number;
  currencyIndex: number;
  unitsIndex: number;
  buyIndex: number;
  sellIndex: number;
}

interface ParsedBcvRate {
  publicationDate: Date;
  rate: number;
}

const REQUIRED_HEADERS = ['PAIS', 'MOEDA', 'UNIDADES', 'COMPRA', 'VENDA'] as const;
const PUBLICATION_HEADING_PATTERN = /^Taxas de Câmbio para o dia\s+(\d{2})\/(\d{2})\/(\d{4})$/i;

export function parseBcvExchangeRateHtml(
  html: string,
  sourceCurrency: string,
  rateType: 'buy' | 'sell',
): ParsedBcvRate {
  const $ = load(html);
  const rateTable = parseRateTable($);
  const publicationDate = parsePublicationDate($, rateTable.element);
  const rate = parseCurrencyRate(rateTable, sourceCurrency, rateType);

  return { publicationDate, rate };
}

function parsePublicationDate($: CheerioAPI, rateTable: Element): Date {
  const matchingHeadings = publicationDateCandidates($, rateTable);

  if (matchingHeadings.length !== 1) {
    throw invalidBcvResponse('publication header is missing or ambiguous');
  }

  const dateMatch = PUBLICATION_HEADING_PATTERN.exec(matchingHeadings[0] ?? '');

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

function publicationDateCandidates($: CheerioAPI, rateTable: Element): string[] {
  const spanningHeaders = tableRows($, $(rateTable)).flatMap((row) => {
    const cells = $(row).children('th,td').toArray();
    const cell = cells[0];

    if (
      cells.length !== 1 ||
      cell?.tagName !== 'th' ||
      $(cell).attr('colspan') !== String(REQUIRED_HEADERS.length)
    ) {
      return [];
    }

    const publicationText = normalizedText($(cell));
    return PUBLICATION_HEADING_PATTERN.test(publicationText) ? [publicationText] : [];
  });
  const adjacentElement = $(rateTable).prev();

  if (!adjacentElement.is('h1,h2,h3,h4,h5,h6')) {
    return spanningHeaders;
  }

  const compatibilityHeading = normalizedText(adjacentElement);

  if (!PUBLICATION_HEADING_PATTERN.test(compatibilityHeading)) {
    return spanningHeaders;
  }

  return [...spanningHeaders, compatibilityHeading];
}

function parseRateTable($: CheerioAPI): BcvRateTable {
  const rateTables = $('table')
    .toArray()
    .flatMap((table) => findRateTables($, $(table)));
  const rateTable = rateTables[0];

  if (rateTables.length !== 1 || !rateTable) {
    throw invalidBcvResponse('official rate table is missing or ambiguous');
  }

  return rateTable;
}

function findRateTables($: CheerioAPI, table: Cheerio<Element>): BcvRateTable[] {
  const tableElement = table.get(0);

  if (!tableElement) {
    return [];
  }

  const rows = tableRows($, table).map((row) =>
    $(row)
      .children('th,td')
      .toArray()
      .map((cell) => $(cell).text().trim()),
  );

  return rows.flatMap((row, headerIndex) => {
    const headers = row.map(headerName);

    if (!REQUIRED_HEADERS.every((header) => count(headers, header) === 1)) {
      return [];
    }

    return [
      {
        element: tableElement,
        rows,
        headerIndex,
        currencyIndex: headers.indexOf('MOEDA'),
        unitsIndex: headers.indexOf('UNIDADES'),
        buyIndex: headers.indexOf('COMPRA'),
        sellIndex: headers.indexOf('VENDA'),
      },
    ];
  });
}

function tableRows($: CheerioAPI, table: Cheerio<Element>): Element[] {
  const tableElement = table.get(0);

  if (!tableElement) {
    return [];
  }

  return table
    .find('tr')
    .toArray()
    .filter((row) => $(row).closest('table').get(0) === tableElement);
}

function parseCurrencyRate(
  rateTable: BcvRateTable,
  sourceCurrency: string,
  rateType: 'buy' | 'sell',
): number {
  const currencyRows = rateTable.rows
    .slice(rateTable.headerIndex + 1)
    .filter((row) => normalizeCurrencyCode(row[rateTable.currencyIndex] ?? '') === sourceCurrency);

  if (currencyRows.length === 0) {
    throw new ExchangeRateError(
      'exchange_rate.currency_unsupported',
      `BCV did not publish a rate for ${sourceCurrency}.`,
    );
  }

  if (currencyRows.length !== 1) {
    throw invalidBcvResponse(`rate row for ${sourceCurrency} is ambiguous`);
  }

  const rateIndex = rateType === 'buy' ? rateTable.buyIndex : rateTable.sellIndex;
  const currencyRow = currencyRows[0];

  if (!currencyRow) {
    throw invalidBcvResponse(`rate row for ${sourceCurrency} is missing`);
  }

  return normalizePublishedRate(currencyRow[rateIndex], currencyRow[rateTable.unitsIndex]);
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
  } catch {
    throw new ExchangeRateError(
      'exchange_rate.rate_invalid',
      'The BCV rate or unit count is invalid.',
    );
  }
}

function parseLocalizedDecimal(value: string | undefined): Decimal {
  if (value === undefined || value.trim().length === 0) {
    throw new Error('A localized decimal value is missing.');
  }

  const trimmedValue = value.trim();
  const quote = trimmedValue[0];
  const unquotedValue =
    (quote === "'" || quote === '"') && trimmedValue.at(-1) === quote
      ? trimmedValue.slice(1, -1)
      : trimmedValue;

  return new Decimal(unquotedValue.replace(/[ \u00a0]/g, '').replace(',', '.'));
}

function normalizedText(element: Cheerio<Element>): string {
  return element.text().replaceAll('\u00a0', ' ').replace(/\s+/g, ' ').trim();
}

function headerName(value: string): string {
  return value
    .replaceAll('\u00a0', ' ')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function count(values: string[], expected: string): number {
  return values.filter((value) => value === expected).length;
}

function invalidBcvResponse(detail: string): ExchangeRateError {
  return new ExchangeRateError(
    'exchange_rate.response_invalid',
    `The BCV exchange-rate response is invalid: ${detail}.`,
  );
}
