import { describe, expect, it, vi } from 'vitest';
import {
  CallbackExchangeRateProvider,
  ExchangeRateError,
  FixedExchangeRateProvider,
} from '../../src';

const request = {
  sourceCurrency: 'EUR',
  targetCurrency: 'CVE',
  effectiveAt: new Date('2026-07-21T12:00:00Z'),
  rateType: 'custom' as const,
};

describe('FixedExchangeRateProvider', () => {
  it('returns a positive fixed rate with its provenance', async () => {
    const provider = new FixedExchangeRateProvider({
      sourceCurrency: ' eur ',
      targetCurrency: 'cve',
      rate: 110.265,
      effectiveAt: new Date('2026-07-21T00:00:00Z'),
      provider: 'Accounting rate',
      sourceUrl: 'https://example.com/accounting-rate',
    });

    await expect(provider.getQuote(request)).resolves.toMatchObject({
      sourceCurrency: 'EUR',
      targetCurrency: 'CVE',
      rate: 110.265,
      rateType: 'custom',
      effectiveAt: new Date('2026-07-21T00:00:00Z'),
      retrievedAt: new Date('2026-07-21T00:00:00Z'),
      provider: 'Accounting rate',
      sourceUrl: 'https://example.com/accounting-rate',
    });
  });

  it('rejects a non-positive fixed rate at construction', () => {
    expect(
      () =>
        new FixedExchangeRateProvider({
          sourceCurrency: 'EUR',
          targetCurrency: 'CVE',
          rate: 0,
          effectiveAt: new Date('2026-07-21T00:00:00Z'),
          provider: 'Accounting rate',
        }),
    ).toThrowError(expect.objectContaining({ code: 'exchange_rate.rate_invalid' }));
  });

  it('enforces its exact configured currency pair', async () => {
    const provider = new FixedExchangeRateProvider({
      sourceCurrency: 'EUR',
      targetCurrency: 'CVE',
      rate: 110.265,
      effectiveAt: new Date('2026-07-21T00:00:00Z'),
      provider: 'Accounting rate',
    });

    await expect(provider.getQuote({ ...request, targetCurrency: 'USD' })).rejects.toMatchObject({
      code: 'exchange_rate.pair_mismatch',
    });
  });
});

describe('CallbackExchangeRateProvider', () => {
  it('forwards the original request to its callback', async () => {
    const callback = vi.fn(async () => ({
      sourceCurrency: 'EUR',
      targetCurrency: 'CVE',
      rate: 110.265,
      rateType: 'custom' as const,
      effectiveAt: new Date('2026-07-21T00:00:00Z'),
      retrievedAt: new Date('2026-07-21T12:00:00Z'),
      provider: 'Accounting rate',
    }));
    const provider = new CallbackExchangeRateProvider(callback);

    await provider.getQuote(request);

    expect(callback).toHaveBeenCalledWith(request);
  });

  it('rejects an invalid callback quote', async () => {
    const provider = new CallbackExchangeRateProvider(async () => ({
      sourceCurrency: 'EUR',
      targetCurrency: 'CVE',
      rate: 0,
      rateType: 'custom',
      effectiveAt: new Date('2026-07-21T00:00:00Z'),
      retrievedAt: new Date('2026-07-21T12:00:00Z'),
      provider: 'Accounting rate',
    }));

    await expect(provider.getQuote(request)).rejects.toMatchObject({
      code: 'exchange_rate.rate_invalid',
    });
  });

  it('preserves exchange-rate errors thrown by the callback', async () => {
    const callbackError = new ExchangeRateError(
      'exchange_rate.currency_unsupported',
      'This pair is unavailable.',
    );
    const provider = new CallbackExchangeRateProvider(async () => {
      throw callbackError;
    });

    await expect(provider.getQuote(request)).rejects.toBe(callbackError);
  });

  it('wraps unknown callback failures with their cause', async () => {
    const cause = new Error('Network unavailable');
    const provider = new CallbackExchangeRateProvider(async () => {
      throw cause;
    });

    await expect(provider.getQuote(request)).rejects.toMatchObject({
      code: 'exchange_rate.provider_unavailable',
      cause,
    });
  });
});
