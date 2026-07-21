import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { BcvExchangeRateProvider } from '../../src';

const sourceUrl = 'https://www.bcv.cv/rates?_expType=PDF';
const fixturePath = fileURLToPath(
  new URL('../fixtures/currency/bcv-rates-2026-07-21.html', import.meta.url),
);
const fixture = await readFile(fixturePath, 'utf8');
const clock = { now: () => new Date('2026-07-21T14:30:00Z') };
const request = {
  sourceCurrency: 'EUR',
  targetCurrency: 'CVE',
  effectiveAt: new Date('2026-07-21T18:00:00Z'),
  rateType: 'buy' as const,
};

describe('BcvExchangeRateProvider source boundary', () => {
  it.each([
    'https://rates.example/official',
    'https://www.bcv.cv.attacker.example/rates',
    'https://www.bcv.cv:8443/rates',
  ])('rejects a source outside the official BCV origin: %s', (untrustedSourceUrl) => {
    const fetcher = vi.fn(async () => new Response(fixture));

    expect(
      () => new BcvExchangeRateProvider({ fetcher, sourceUrl: untrustedSourceUrl }),
    ).toThrowError(expect.objectContaining({ code: 'exchange_rate.source_required' }));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('disables automatic redirects when fetching an official BCV page', async () => {
    const fetcher = vi.fn(async () => new Response(fixture));
    const provider = new BcvExchangeRateProvider({ fetcher, clock, sourceUrl });

    await expect(provider.getQuote(request)).resolves.toMatchObject({ rate: 110.265 });
    expect(fetcher).toHaveBeenCalledWith(
      sourceUrl,
      expect.objectContaining({ redirect: 'manual' }),
    );
  });

  it('rejects a redirect without exposing its destination', async () => {
    const locationSentinel = 'https://redirect.example/BCV_UPSTREAM_SECRET';
    const fetcher = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: locationSentinel },
        }),
    );
    const provider = new BcvExchangeRateProvider({ fetcher, clock, sourceUrl });

    try {
      await provider.getQuote(request);
      throw new Error('Expected quote retrieval to fail.');
    } catch (error) {
      expect(error).toMatchObject({ code: 'exchange_rate.provider_unavailable' });
      expect(String(error)).not.toContain(locationSentinel);
      expect(String((error as Error & { cause?: unknown }).cause)).not.toContain(locationSentinel);
    }
  });
});
