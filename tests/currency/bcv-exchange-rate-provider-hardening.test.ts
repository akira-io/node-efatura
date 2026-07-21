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
  it('accepts the official spanning publication header in the identified rate table', async () => {
    await expect(providerFor().getQuote(request())).resolves.toMatchObject({
      effectiveAt: new Date('2026-07-21T00:00:00.000Z'),
      rate: 110.265,
    });
  });

  it('accepts one adjacent semantic heading as a compatibility shape', async () => {
    const compatibleHeading = fixture
      .replace('      <tr><th colspan="5">Taxas de Câmbio para o dia 21/07/2026</th></tr>\n', '')
      .replace(
        '  <table class="table table-striped table-bordered">',
        '  <h2>Taxas de Câmbio para o dia 21/07/2026</h2>\n  <table class="table table-striped table-bordered">',
      );

    await expect(providerFor(compatibleHeading).getQuote(request())).resolves.toMatchObject({
      effectiveAt: new Date('2026-07-21T00:00:00.000Z'),
    });
  });

  it('requires the spanning publication text to match exactly', async () => {
    const suffixedHeading = fixture.replace(
      '21/07/2026</th>',
      '21/07/2026 - informação provisória</th>',
    );

    await expect(providerFor(suffixedHeading).getQuote(request())).rejects.toMatchObject({
      code: 'exchange_rate.response_invalid',
    });
  });

  it('rejects duplicate spanning publication headers in the rate table', async () => {
    const publicationHeader = '<tr><th colspan="5">Taxas de Câmbio para o dia 21/07/2026</th></tr>';
    const duplicateHeading = fixture.replace(
      publicationHeader,
      `${publicationHeader}${publicationHeader}`,
    );

    await expect(providerFor(duplicateHeading).getQuote(request())).rejects.toMatchObject({
      code: 'exchange_rate.response_invalid',
    });
  });

  it('rejects ambiguity between official and compatibility publication candidates', async () => {
    const ambiguousHeading = fixture.replace(
      '  <table class="table table-striped table-bordered">',
      '  <h2>Taxas de Câmbio para o dia 21/07/2026</h2>\n  <table class="table table-striped table-bordered">',
    );

    await expect(providerFor(ambiguousHeading).getQuote(request())).rejects.toMatchObject({
      code: 'exchange_rate.response_invalid',
    });
  });

  it('ignores dated headers in unrelated tables and non-adjacent headings', async () => {
    const unrelatedMarkup = fixture
      .replace(
        '<main>',
        '<main><table><tr><th colspan="5">Taxas de Câmbio para o dia 20/07/2026</th></tr></table>',
      )
      .replace(
        '</main>',
        '<section><h3>Taxas de Câmbio para o dia 20/07/2026</h3></section></main>',
      );

    await expect(providerFor(unrelatedMarkup).getQuote(request())).resolves.toMatchObject({
      effectiveAt: new Date('2026-07-21T00:00:00.000Z'),
    });
  });

  it('rejects duplicate official rate tables', async () => {
    const table = fixture.match(
      /<table class="table table-striped table-bordered">[\s\S]*<\/table>/,
    )?.[0];

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

  it.each([
    ['timeoutMs', 0],
    ['timeoutMs', -1],
    ['timeoutMs', 1.5],
    ['timeoutMs', Number.NaN],
    ['timeoutMs', Number.POSITIVE_INFINITY],
    ['timeoutMs', Number.MAX_SAFE_INTEGER + 1],
    ['maxResponseBytes', 0],
    ['maxResponseBytes', -1],
    ['maxResponseBytes', 1.5],
    ['maxResponseBytes', Number.NaN],
    ['maxResponseBytes', Number.POSITIVE_INFINITY],
    ['maxResponseBytes', Number.MAX_SAFE_INTEGER + 1],
  ])('rejects invalid positive integer option %s=%s at construction', (option, value) => {
    expect(() => providerFor(fixture, { [option]: value })).toThrowError(
      expect.objectContaining({ code: 'exchange_rate.response_invalid' }),
    );
  });

  it.each([
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])('rejects invalid publication age %s at construction', (maxPublicationAgeDays) => {
    expect(() => providerFor(fixture, { maxPublicationAgeDays })).toThrowError(
      expect.objectContaining({ code: 'exchange_rate.response_invalid' }),
    );
  });

  it('accepts a zero maximum publication age', () => {
    expect(() => providerFor(fixture, { maxPublicationAgeDays: 0 })).not.toThrow();
  });

  it('rejects source URL credentials without retaining them in the error', () => {
    const credentialSentinel = 'BCV_SECRET_PASSWORD';

    try {
      providerFor(fixture, {
        sourceUrl: `https://user:${credentialSentinel}@www.bcv.cv/rates`,
      });
      throw new Error('Expected construction to fail.');
    } catch (error) {
      expect(error).toMatchObject({ code: 'exchange_rate.source_required' });
      expect(String(error)).not.toContain(credentialSentinel);
      expect(String((error as Error & { cause?: unknown }).cause)).not.toContain(
        credentialSentinel,
      );
    }
  });

  it('does not retain invalid upstream decimal text as an error cause', async () => {
    const responseSentinel = 'BCV_UPSTREAM_SECRET';
    const invalidRate = fixture.replace('<td>110,26500</td>', `<td>${responseSentinel}</td>`);

    try {
      await providerFor(invalidRate).getQuote(request());
      throw new Error('Expected quote retrieval to fail.');
    } catch (error) {
      expect(error).toMatchObject({ code: 'exchange_rate.rate_invalid' });
      expect(String(error)).not.toContain(responseSentinel);
      expect(String((error as Error & { cause?: unknown }).cause)).not.toContain(responseSentinel);
    }
  });

  it.each([
    '2026-07-21T22:59:00.000Z',
    '2026-07-21T23:00:00.000Z',
  ])('uses the same Cape Verde printed date at %s', async (effectiveAt) => {
    await expect(
      providerFor().getQuote({ ...request(), effectiveAt: new Date(effectiveAt) }),
    ).resolves.toMatchObject({ effectiveAt: new Date('2026-07-21T00:00:00.000Z') });
  });

  it('changes Cape Verde calendar day at 01:00Z', async () => {
    const previousPublication = fixture.replace('21/07/2026', '20/07/2026');

    await expect(
      providerFor(previousPublication).getQuote({
        ...request(),
        effectiveAt: new Date('2026-07-21T00:59:59.999Z'),
      }),
    ).resolves.toMatchObject({ effectiveAt: new Date('2026-07-20T00:00:00.000Z') });
    await expect(
      providerFor().getQuote({
        ...request(),
        effectiveAt: new Date('2026-07-21T01:00:00.000Z'),
      }),
    ).resolves.toMatchObject({ effectiveAt: new Date('2026-07-21T00:00:00.000Z') });
  });

  it('uses the previous Cape Verde year at the UTC year boundary', async () => {
    const yearEndPublication = fixture.replace('21/07/2026', '31/12/2026');

    await expect(
      providerFor(yearEndPublication).getQuote({
        ...request(),
        effectiveAt: new Date('2027-01-01T00:59:59.999Z'),
      }),
    ).resolves.toMatchObject({ effectiveAt: new Date('2026-12-31T00:00:00.000Z') });
  });
});
