import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { WorldBankExchangeRateProvider } from '../../src';

const cpvFixture = await readFixture('world-bank-cpv.json');
const emuFixture = await readFixture('world-bank-emu.json');
const retrievedAt = new Date('2026-07-21T14:30:00Z');

function readFixture(name: string): Promise<string> {
  return readFile(fileURLToPath(new URL(`../fixtures/currency/${name}`, import.meta.url)), 'utf8');
}

function fixtureFetcher(): typeof fetch {
  return vi.fn(async (input) => {
    const url = new URL(input.toString());
    return new Response(url.pathname.includes('/CPV/') ? cpvFixture : emuFixture);
  });
}

function request() {
  return {
    sourceCurrency: 'EUR',
    targetCurrency: 'CVE',
    effectiveAt: new Date('2025-07-21T00:00:00Z'),
    rateType: 'reference' as const,
  };
}

describe('WorldBankExchangeRateProvider provenance', () => {
  it('locks the CVE economy mapping to Cabo Verde', () => {
    expect(
      () =>
        new WorldBankExchangeRateProvider({
          economyByCurrency: { CVE: 'EMU' },
        }),
    ).toThrowError(expect.objectContaining({ code: 'exchange_rate.response_invalid' }));
  });

  it('accepts the locked CVE mapping when restated exactly', () => {
    expect(
      () =>
        new WorldBankExchangeRateProvider({
          economyByCurrency: { CVE: 'CPV' },
        }),
    ).not.toThrow();
  });

  it('restricts observations to the supported LCU-per-USD indicator', () => {
    expect(() => new WorldBankExchangeRateProvider({ indicator: 'NY.GDP.MKTP.CD' })).toThrowError(
      expect.objectContaining({ code: 'exchange_rate.response_invalid' }),
    );
  });

  it('rejects custom endpoints that would receive World Bank attribution', () => {
    expect(
      () => new WorldBankExchangeRateProvider({ baseUrl: 'https://rates.example/api' }),
    ).toThrowError(expect.objectContaining({ code: 'exchange_rate.source_required' }));
  });

  it('rejects base URL credentials without retaining them in the error', () => {
    const credentialSentinel = 'WORLD_BANK_SECRET_PASSWORD';

    try {
      new WorldBankExchangeRateProvider({
        baseUrl: `https://user:${credentialSentinel}@api.worldbank.org`,
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

  it('preserves exact cross-rate observation evidence in quote metadata', async () => {
    const provider = new WorldBankExchangeRateProvider({
      fetcher: fixtureFetcher(),
      clock: { now: () => new Date(retrievedAt) },
      economyByCurrency: { EUR: 'EMU' },
    });

    const quote = await provider.getQuote(request());

    expect(quote).toMatchObject({
      provider: 'World Bank PA.NUS.FCRF',
      evidence: {
        source: 'World Bank',
        indicator: 'PA.NUS.FCRF',
        observationPeriod: '2025',
        legs: [
          {
            role: 'source',
            currency: 'EUR',
            economy: 'EMU',
            value: '0.9234',
            sourceUrl:
              'https://api.worldbank.org/v2/country/EMU/indicator/PA.NUS.FCRF?format=json&date=2025&per_page=1',
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
});
