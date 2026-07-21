import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { BcvExchangeRateProvider } from '../../src';

const fixturePath = fileURLToPath(
  new URL('../fixtures/currency/bcv-rates-2026-07-21.html', import.meta.url),
);
const fixture = await readFile(fixturePath, 'utf8');
const clock = { now: () => new Date('2026-07-21T14:30:00Z') };

function providerFor(
  body = fixture,
  options: Partial<ConstructorParameters<typeof BcvExchangeRateProvider>[0]> = {},
): BcvExchangeRateProvider {
  return new BcvExchangeRateProvider({
    fetcher: vi.fn(async () => new Response(body)),
    clock,
    sourceUrl: 'https://www.bcv.cv/rates?_expType=PDF',
    ...options,
  });
}

function request(sourceCurrency = 'EUR') {
  return {
    sourceCurrency,
    targetCurrency: 'CVE',
    effectiveAt: new Date('2026-07-21T18:00:00Z'),
    rateType: 'buy' as const,
  };
}

describe('BcvExchangeRateProvider response hardening', () => {
  it('requires the publication date to be in a semantic heading', async () => {
    const nonSemanticHeading = fixture.replace('<h1>', '<div>').replace('</h1>', '</div>');

    await expect(providerFor(nonSemanticHeading).getQuote(request())).rejects.toMatchObject({
      code: 'exchange_rate.response_invalid',
    });
  });

  it('requires the dated heading text to match exactly', async () => {
    const suffixedHeading = fixture.replace('</h1>', ' - informação provisória</h1>');

    await expect(providerFor(suffixedHeading).getQuote(request())).rejects.toMatchObject({
      code: 'exchange_rate.response_invalid',
    });
  });

  it('rejects duplicate dated headings', async () => {
    const duplicateHeading = fixture.replace(
      '<table>',
      '<h2>Taxas de Câmbio para o dia 21/07/2026</h2><table>',
    );

    await expect(providerFor(duplicateHeading).getQuote(request())).rejects.toMatchObject({
      code: 'exchange_rate.response_invalid',
    });
  });

  it('rejects duplicate official rate tables', async () => {
    const table = fixture.match(/<table>[\s\S]*<\/table>/)?.[0];

    expect(table).toBeDefined();
    const duplicateTable = fixture.replace('</main>', `${table}</main>`);

    await expect(providerFor(duplicateTable).getQuote(request())).rejects.toMatchObject({
      code: 'exchange_rate.response_invalid',
    });
  });

  it('rejects duplicate official header rows', async () => {
    const header =
      '<tr><th>País</th><th>Moeda</th><th>Unidades</th><th>Compra</th><th>Venda</th></tr>';
    const duplicateHeader = fixture.replace(header, `${header}${header}`);

    await expect(providerFor(duplicateHeader).getQuote(request())).rejects.toMatchObject({
      code: 'exchange_rate.response_invalid',
    });
  });

  it('rejects duplicate rows for the requested currency', async () => {
    const eurRow =
      '<tr><td>Zona Euro</td><td>EUR</td><td>1</td><td>110,26500</td><td>110,26500</td></tr>';
    const duplicateCurrency = fixture.replace(eurRow, `${eurRow}${eurRow}`);

    await expect(providerFor(duplicateCurrency).getQuote(request())).rejects.toMatchObject({
      code: 'exchange_rate.response_invalid',
    });
  });

  it.each(["'100'", '"100"'])('accepts matching quote wrappers around units: %s', async (units) => {
    const quotedUnits = fixture.replace('<td>100</td>', `<td>${units}</td>`);

    await expect(providerFor(quotedUnits).getQuote(request('JPY'))).resolves.toMatchObject({
      rate: 0.59727,
    });
  });

  it.each([
    '\'100"',
    "1'00",
  ])('rejects mismatched or internal quote characters: %s', async (units) => {
    const invalidUnits = fixture.replace('<td>100</td>', `<td>${units}</td>`);

    await expect(providerFor(invalidUnits).getQuote(request('JPY'))).rejects.toMatchObject({
      code: 'exchange_rate.rate_invalid',
    });
  });
});
