import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BcvExchangeRateProvider } from '../../src';

const sourceUrl = 'https://www.bcv.cv/rates?_expType=PDF';
const retrievedAt = new Date('2026-07-21T14:30:00Z');
const fixturePath = fileURLToPath(
  new URL('../fixtures/currency/bcv-rates-2026-07-21.html', import.meta.url),
);
const fixture = await readFile(fixturePath, 'utf8');

const clock = { now: () => new Date(retrievedAt) };

function response(body = fixture, init: ResponseInit = {}): Response {
  return new Response(body, { status: 200, ...init });
}

function providerFor(
  body = fixture,
  options: Partial<ConstructorParameters<typeof BcvExchangeRateProvider>[0]> = {},
): BcvExchangeRateProvider {
  return new BcvExchangeRateProvider({
    fetcher: vi.fn(async () => response(body)),
    clock,
    sourceUrl,
    ...options,
  });
}

function request(
  sourceCurrency = 'EUR',
  options: { effectiveAt?: Date; rateType?: 'buy' | 'sell' } = {},
) {
  return {
    sourceCurrency,
    targetCurrency: 'CVE',
    effectiveAt: options.effectiveAt ?? new Date('2026-07-21T18:00:00Z'),
    rateType: options.rateType ?? ('buy' as const),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('BcvExchangeRateProvider', () => {
  it('returns the official EUR buy rate with BCV provenance', async () => {
    const provider = providerFor();

    await expect(provider.getQuote(request())).resolves.toEqual({
      sourceCurrency: 'EUR',
      targetCurrency: 'CVE',
      rate: 110.265,
      rateType: 'buy',
      effectiveAt: new Date('2026-07-21T00:00:00.000Z'),
      retrievedAt,
      provider: 'Banco de Cabo Verde',
      sourceUrl,
    });
  });

  it('normalizes rates quoted per 100 units', async () => {
    const quote = await providerFor().getQuote(request('JPY'));

    expect(quote.rate).toBe(0.59727);
  });

  it('selects the explicit sell rate', async () => {
    const quote = await providerFor().getQuote(request('JPY', { rateType: 'sell' }));

    expect(quote).toMatchObject({ rate: 0.59854, rateType: 'sell' });
  });

  it('accepts decimal commas, normal spaces, and non-breaking spaces', async () => {
    const localized = fixture.replace(
      '<td>110,26500</td><td>110,26500</td>',
      '<td>1 10,265 00</td><td>1\u00a010,265\u00a000</td>',
    );

    await expect(providerFor(localized).getQuote(request())).resolves.toMatchObject({
      rate: 110.265,
    });
    await expect(
      providerFor(localized).getQuote(request('EUR', { rateType: 'sell' })),
    ).resolves.toMatchObject({ rate: 110.265 });
  });

  it('matches publication and request dates by exact UTC calendar day', async () => {
    await expect(
      providerFor().getQuote(
        request('EUR', { effectiveAt: new Date('2026-07-21T00:00:01-10:00') }),
      ),
    ).resolves.toMatchObject({ effectiveAt: new Date('2026-07-21T00:00:00.000Z') });
  });

  it('permits an earlier publication within the configured maximum age', async () => {
    const provider = providerFor(fixture, {
      allowPreviousPublication: true,
      maxPublicationAgeDays: 3,
    });

    await expect(
      provider.getQuote(request('EUR', { effectiveAt: new Date('2026-07-24T12:00:00Z') })),
    ).resolves.toMatchObject({ effectiveAt: new Date('2026-07-21T00:00:00.000Z') });
  });

  it('rejects an earlier publication in strict mode', async () => {
    await expect(
      providerFor().getQuote(request('EUR', { effectiveAt: new Date('2026-07-22T12:00:00Z') })),
    ).rejects.toMatchObject({ code: 'exchange_rate.date_unavailable' });
  });

  it('rejects a publication older than the configured maximum age', async () => {
    const provider = providerFor(fixture, {
      allowPreviousPublication: true,
      maxPublicationAgeDays: 2,
    });

    await expect(
      provider.getQuote(request('EUR', { effectiveAt: new Date('2026-07-24T12:00:00Z') })),
    ).rejects.toMatchObject({ code: 'exchange_rate.stale' });
  });

  it('rejects a future publication', async () => {
    await expect(
      providerFor().getQuote(request('EUR', { effectiveAt: new Date('2026-07-20T12:00:00Z') })),
    ).rejects.toMatchObject({ code: 'exchange_rate.date_invalid' });
  });

  it('rejects a response without the dated BCV heading', async () => {
    await expect(
      providerFor('<main><table></table></main>').getQuote(request()),
    ).rejects.toMatchObject({ code: 'exchange_rate.response_invalid' });
  });

  it('rejects a malformed publication date', async () => {
    const malformed = fixture.replace('21/07/2026', '31/02/2026');

    await expect(providerFor(malformed).getQuote(request())).rejects.toMatchObject({
      code: 'exchange_rate.response_invalid',
    });
  });

  it('rejects a currency absent from the table', async () => {
    await expect(providerFor().getQuote(request('USD'))).rejects.toMatchObject({
      code: 'exchange_rate.currency_unsupported',
    });
  });

  it('rejects a table missing a required column', async () => {
    const missingColumn = fixture.replace('<th>Venda</th>', '<th>Outro</th>');

    await expect(providerFor(missingColumn).getQuote(request('EUR'))).rejects.toMatchObject({
      code: 'exchange_rate.response_invalid',
    });
  });

  it.each([
    ['zero units', '<td>1</td><td>110,26500</td>', '<td>0</td><td>110,26500</td>'],
    ['invalid units', '<td>1</td><td>110,26500</td>', '<td>one</td><td>110,26500</td>'],
    ['invalid rate', '<td>110,26500</td>', '<td>not-a-rate</td>'],
  ])('rejects %s', async (_label, original, replacement) => {
    const invalid = fixture.replace(original, replacement);

    await expect(providerFor(invalid).getQuote(request())).rejects.toMatchObject({
      code: 'exchange_rate.rate_invalid',
    });
  });

  it('rejects non-2xx responses without parsing their body', async () => {
    const fetcher = vi.fn(async () => response('unavailable', { status: 503 }));
    const provider = providerFor(fixture, { fetcher });

    await expect(provider.getQuote(request())).rejects.toMatchObject({
      code: 'exchange_rate.provider_unavailable',
    });
  });

  it('aborts a fetch that exceeds the configured timeout', async () => {
    vi.useFakeTimers();
    const fetcher: typeof fetch = vi.fn((_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
      });
    });
    const provider = providerFor(fixture, { fetcher, timeoutMs: 25 });

    const quote = provider.getQuote(request());
    await vi.advanceTimersByTimeAsync(25);

    await expect(quote).rejects.toMatchObject({ code: 'exchange_rate.provider_unavailable' });
  });

  it('rejects a response whose UTF-8 byte length exceeds the configured limit', async () => {
    const provider = providerFor(fixture, {
      maxResponseBytes: Buffer.byteLength(fixture, 'utf8') - 1,
    });

    await expect(provider.getQuote(request())).rejects.toMatchObject({
      code: 'exchange_rate.response_invalid',
    });
  });

  it('rejects unsupported target currencies and rate types before fetching', async () => {
    const fetcher = vi.fn(async () => response());
    const provider = providerFor(fixture, { fetcher });

    await expect(provider.getQuote({ ...request(), targetCurrency: 'USD' })).rejects.toMatchObject({
      code: 'exchange_rate.pair_mismatch',
    });
    await expect(provider.getQuote({ ...request(), rateType: 'reference' })).rejects.toMatchObject({
      code: 'exchange_rate.pair_mismatch',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
