import { describe, expect, it } from 'vitest';
import { ExchangeRateError, normalizeCurrencyCode, validateExchangeRateQuote } from '../../src';

const request = {
  sourceCurrency: 'EUR',
  targetCurrency: 'CVE',
  effectiveAt: new Date('2026-07-21T12:00:00Z'),
  rateType: 'buy' as const,
};

function validQuote(overrides = {}) {
  return {
    sourceCurrency: 'EUR',
    targetCurrency: 'CVE',
    rate: 110.265,
    rateType: 'buy' as const,
    effectiveAt: new Date('2026-07-21T00:00:00Z'),
    retrievedAt: new Date('2026-07-21T12:00:00Z'),
    provider: 'Banco de Cabo Verde',
    sourceUrl: 'https://www.bcv.cv/rates',
    ...overrides,
  };
}

describe('exchange-rate quotes', () => {
  it.each([
    [' eur ', 'EUR'],
    ['cve', 'CVE'],
    ['USD', 'USD'],
    ['jpy', 'JPY'],
  ])('normalizes supported currency code %j to %s', (currencyCode, expected) => {
    expect(normalizeCurrencyCode(currencyCode)).toBe(expected);
  });

  it.each(['AAA', 'EU', 'EURO', '12A'])('rejects unsupported currency code %j', (currencyCode) => {
    expect(() => normalizeCurrencyCode(currencyCode)).toThrowError(
      expect.objectContaining({ code: 'exchange_rate.currency_unsupported' }),
    );
  });

  it('rejects an unsupported requested currency before quote comparison', () => {
    expect(() =>
      validateExchangeRateQuote(
        { ...request, sourceCurrency: 'AAA' },
        validQuote({ sourceCurrency: 'AAA' }),
      ),
    ).toThrowError(expect.objectContaining({ code: 'exchange_rate.currency_unsupported' }));
  });

  it('normalizes and validates a matching quote without mutating the provider output', () => {
    const providerQuote = validQuote({
      sourceCurrency: 'eur',
      targetCurrency: 'cve',
      rate: 110.2654321,
    });

    const quote = validateExchangeRateQuote(request, providerQuote);

    expect(quote).toMatchObject({
      sourceCurrency: 'EUR',
      targetCurrency: 'CVE',
      rate: 110.26543,
    });
    expect(quote).not.toBe(providerQuote);
    expect(providerQuote).toMatchObject({
      sourceCurrency: 'eur',
      targetCurrency: 'cve',
      rate: 110.2654321,
    });
  });

  it('rejects a quote for a different currency pair', () => {
    expect(() =>
      validateExchangeRateQuote(request, validQuote({ targetCurrency: 'USD' })),
    ).toThrowError(expect.objectContaining({ code: 'exchange_rate.pair_mismatch' }));
  });

  it('rejects a quote with a different rate type', () => {
    expect(() => validateExchangeRateQuote(request, validQuote({ rateType: 'sell' }))).toThrowError(
      expect.objectContaining({ code: 'exchange_rate.pair_mismatch' }),
    );
  });

  it.each([
    0,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    0.000004,
  ])('rejects invalid rate %s', (rate) => {
    expect(() => validateExchangeRateQuote(request, validQuote({ rate }))).toThrowError(
      expect.objectContaining({
        code: 'exchange_rate.rate_invalid',
      }),
    );
  });

  it.each([
    ['effectiveAt', new Date('invalid')],
    ['retrievedAt', new Date('invalid')],
  ] as const)('rejects an invalid %s date', (field, value) => {
    expect(() => validateExchangeRateQuote(request, validQuote({ [field]: value }))).toThrowError(
      expect.objectContaining({ code: 'exchange_rate.date_invalid' }),
    );
  });

  it('rejects a quote published after the requested effective date', () => {
    expect(() =>
      validateExchangeRateQuote(
        request,
        validQuote({ effectiveAt: new Date('2026-07-22T00:00:00Z') }),
      ),
    ).toThrowError(expect.objectContaining({ code: 'exchange_rate.date_unavailable' }));
  });

  it('rejects an empty provider', () => {
    expect(() => validateExchangeRateQuote(request, validQuote({ provider: '  ' }))).toThrowError(
      expect.objectContaining({ code: 'exchange_rate.response_invalid' }),
    );
  });

  it('preserves an absent source URL', () => {
    const quote = validateExchangeRateQuote(request, validQuote({ sourceUrl: undefined }));

    expect(quote.sourceUrl).toBeUndefined();
  });

  it.each([
    '',
    'http://www.bcv.cv/rates',
    'not a URL',
  ])('rejects a supplied invalid source URL: %s', (sourceUrl) => {
    expect(() => validateExchangeRateQuote(request, validQuote({ sourceUrl }))).toThrowError(
      expect.objectContaining({ code: 'exchange_rate.source_required' }),
    );
  });

  it('exposes exchange-rate failures as ExchangeRateError instances', () => {
    expect(() => validateExchangeRateQuote(request, validQuote({ rate: 0 }))).toThrowError(
      ExchangeRateError,
    );
  });
});
