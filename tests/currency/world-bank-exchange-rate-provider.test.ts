import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExchangeRateError, WorldBankExchangeRateProvider } from '../../src';

const cpvFixture = await readFixture('world-bank-cpv.json');
const emuFixture = await readFixture('world-bank-emu.json');
const retrievedAt = new Date('2026-07-21T14:30:00Z');
const clock = { now: () => new Date(retrievedAt) };

function readFixture(name: string): Promise<string> {
  const path = fileURLToPath(new URL(`../fixtures/currency/${name}`, import.meta.url));
  return readFile(path, 'utf8');
}

function response(body: string, init: ResponseInit = {}): Response {
  return new Response(body, { status: 200, ...init });
}

function fixtureFetcher(): typeof fetch {
  return vi.fn(async (input) => {
    const url = new URL(input.toString());

    if (url.pathname.includes('/CPV/')) {
      return response(cpvFixture);
    }

    if (url.pathname.includes('/EMU/')) {
      return response(emuFixture);
    }

    throw new Error(`Unexpected World Bank economy: ${url.pathname}`);
  });
}

function providerFor(
  options: Partial<ConstructorParameters<typeof WorldBankExchangeRateProvider>[0]> = {},
): WorldBankExchangeRateProvider {
  return new WorldBankExchangeRateProvider({
    fetcher: fixtureFetcher(),
    clock,
    economyByCurrency: { EUR: 'EMU' },
    ...options,
  });
}

function request(sourceCurrency = 'USD', targetCurrency = 'CVE') {
  return {
    sourceCurrency,
    targetCurrency,
    effectiveAt: new Date('2025-07-21T00:00:00Z'),
    rateType: 'reference' as const,
  };
}

async function exchangeRateError(promise: Promise<unknown>): Promise<ExchangeRateError> {
  let caughtError: unknown;

  try {
    await promise;
  } catch (error) {
    caughtError = error;
  }

  if (!(caughtError instanceof ExchangeRateError)) {
    throw new Error('Expected an ExchangeRateError.');
  }

  return caughtError;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('WorldBankExchangeRateProvider', () => {
  it('returns the CVE-per-USD observation with annual reference provenance', async () => {
    await expect(providerFor().getQuote(request())).resolves.toEqual({
      sourceCurrency: 'USD',
      targetCurrency: 'CVE',
      rate: 101.7495,
      rateType: 'reference',
      effectiveAt: new Date('2025-01-01T00:00:00.000Z'),
      retrievedAt,
      provider: 'World Bank PA.NUS.FCRF',
      sourceUrl: 'https://data.worldbank.org/indicator/PA.NUS.FCRF',
      evidence: {
        source: 'World Bank',
        indicator: 'PA.NUS.FCRF',
        observationPeriod: '2025',
        legs: [
          {
            role: 'source',
            currency: 'USD',
            economy: null,
            value: '1',
            sourceUrl: undefined,
          },
          {
            role: 'target',
            currency: 'CVE',
            economy: 'CPV',
            value: '101.7495',
            sourceUrl:
              'https://api.worldbank.org/v2/country/CPV/indicator/PA.NUS.FCRF?format=json&date=2025&per_page=1',
          },
        ],
      },
    });
  });

  it('calculates an EUR-to-CVE cross rate from the same observation year', async () => {
    const quote = await providerFor().getQuote(request('EUR'));

    expect(quote.rate).toBe(110.19006);
    expect(quote.effectiveAt.getUTCFullYear()).toBe(2025);
  });

  it('uses USD as an identity leg without an economy lookup', async () => {
    const fetcher = vi.fn(async () => response(cpvFixture));
    const provider = providerFor({ fetcher });

    await expect(provider.getQuote(request('USD', 'USD'))).resolves.toMatchObject({ rate: 1 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('requests the exact UTC observation year for each non-USD leg', async () => {
    const fetcher = fixtureFetcher();
    const provider = providerFor({ fetcher });

    await provider.getQuote(request('EUR'));

    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [input] of vi.mocked(fetcher).mock.calls) {
      const url = new URL(input.toString());
      expect(url.searchParams.get('format')).toBe('json');
      expect(url.searchParams.get('date')).toBe('2025');
      expect(url.searchParams.get('per_page')).toBe('1');
    }
  });

  it('rejects a null observation without falling back', async () => {
    const nullObservation = cpvFixture.replace('"value": 101.7495', '"value": null');
    const provider = providerFor({ fetcher: vi.fn(async () => response(nullObservation)) });

    await expect(provider.getQuote(request())).rejects.toMatchObject({
      code: 'exchange_rate.date_unavailable',
    });
  });

  it('rejects a missing observation without falling back', async () => {
    const missingObservation = JSON.stringify([JSON.parse(cpvFixture)[0], []]);
    const provider = providerFor({ fetcher: vi.fn(async () => response(missingObservation)) });

    await expect(provider.getQuote(request())).rejects.toMatchObject({
      code: 'exchange_rate.date_unavailable',
    });
  });

  it('rejects an observation from a different year', async () => {
    const mismatchedYear = emuFixture.replace('"date": "2025"', '"date": "2024"');
    const fetcher: typeof fetch = vi.fn(async (input) =>
      response(input.toString().includes('/EMU/') ? mismatchedYear : cpvFixture),
    );
    const provider = providerFor({ fetcher });

    await expect(provider.getQuote(request('EUR'))).rejects.toMatchObject({
      code: 'exchange_rate.date_unavailable',
    });
  });

  it('does not expose invalid observation data through parser errors', async () => {
    const secretSentinel = 'TOP_SECRET_TOKEN';
    const invalidObservation = cpvFixture.replace(
      '"value": 101.7495',
      `"value": "${secretSentinel}"`,
    );
    const provider = providerFor({ fetcher: vi.fn(async () => response(invalidObservation)) });

    const error = await exchangeRateError(provider.getQuote(request()));

    expect(error.code).toBe('exchange_rate.response_invalid');
    expect(error.message).not.toContain(secretSentinel);
    expect(String(error.cause)).not.toContain(secretSentinel);
  });

  it('requires an explicit economy mapping for ambiguous currencies', async () => {
    const fetcher = fixtureFetcher();
    const provider = new WorldBankExchangeRateProvider({ fetcher, clock });

    await expect(provider.getQuote(request('EUR'))).rejects.toMatchObject({
      code: 'exchange_rate.currency_unsupported',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    'buy',
    'sell',
    'custom',
  ] as const)('rejects the unsupported %s rate type', async (rateType) => {
    const fetcher = fixtureFetcher();
    const provider = providerFor({ fetcher });

    await expect(provider.getQuote({ ...request(), rateType })).rejects.toMatchObject({
      code: 'exchange_rate.pair_mismatch',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects non-2xx responses', async () => {
    const fetcher = vi.fn(async () => response('unavailable', { status: 503 }));

    await expect(providerFor({ fetcher }).getQuote(request())).rejects.toMatchObject({
      code: 'exchange_rate.provider_unavailable',
    });
  });

  it('aborts a fetch that exceeds the configured timeout', async () => {
    vi.useFakeTimers();
    const fetcher: typeof fetch = vi.fn(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), {
            once: true,
          });
        }),
    );
    const quote = providerFor({ fetcher, timeoutMs: 25 }).getQuote(request());

    await vi.advanceTimersByTimeAsync(25);

    await expect(quote).rejects.toMatchObject({ code: 'exchange_rate.provider_unavailable' });
  });

  it('rejects an oversized response', async () => {
    const provider = providerFor({
      fetcher: vi.fn(async () => response(cpvFixture)),
      maxResponseBytes: Buffer.byteLength(cpvFixture, 'utf8') - 1,
    });

    await expect(provider.getQuote(request())).rejects.toMatchObject({
      code: 'exchange_rate.response_invalid',
    });
  });

  it('wraps body stream failures as stable provider-unavailable errors', async () => {
    const failingBodyStream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error('body stream failed'));
      },
    });
    const provider = providerFor({ fetcher: vi.fn(async () => new Response(failingBodyStream)) });

    await expect(provider.getQuote(request())).rejects.toMatchObject({
      code: 'exchange_rate.provider_unavailable',
      message: 'The World Bank exchange-rate source is unavailable.',
      cause: undefined,
    });
  });

  it('rejects malformed JSON without exposing response data', async () => {
    const secretSentinel = 'TOP_SECRET_TOKEN';
    const provider = providerFor({ fetcher: vi.fn(async () => response(secretSentinel)) });

    const error = await exchangeRateError(provider.getQuote(request()));

    expect(error.code).toBe('exchange_rate.response_invalid');
    expect(error.message).not.toContain(secretSentinel);
    expect(String(error.cause)).not.toContain(secretSentinel);
  });
});
