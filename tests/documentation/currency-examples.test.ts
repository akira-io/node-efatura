import { readFile } from 'node:fs/promises';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { dfa, prepared, xml } from '../../docs/examples/currency/eur-to-cve';
import {
  BcvExchangeRateProvider,
  type BcvExchangeRateProviderOptions,
  CallbackExchangeRateProvider,
  type CurrencyConversionMetadata,
  type DfaRenderer,
  type DfaRenderInput,
  type EfaturaDependencies,
  type ExchangeRateCallback,
  ExchangeRateError,
  type ExchangeRateErrorCode,
  type ExchangeRateProvider,
  type ExchangeRateQuote,
  type ExchangeRateRequest,
  type ExchangeRateType,
  FixedExchangeRateProvider,
  type FixedExchangeRateProviderOptions,
  normalizeCurrencyCode,
  type PreparedCurrencyInvoice,
  type PrepareInvoiceToCveOptions,
  type RenderDfaOptions,
  validateExchangeRateQuote,
  WorldBankExchangeRateProvider,
  type WorldBankExchangeRateProviderOptions,
} from '../../src';

const iud = 'CV3260208100200300001230100000000112345678909';

describe('currency conversion documentation', () => {
  it('exports every documented currency conversion symbol', () => {
    const runtimeSymbols = [
      BcvExchangeRateProvider,
      CallbackExchangeRateProvider,
      ExchangeRateError,
      FixedExchangeRateProvider,
      WorldBankExchangeRateProvider,
      normalizeCurrencyCode,
      validateExchangeRateQuote,
    ];

    runtimeSymbols.forEach((symbol) => {
      expect(symbol).toBeTypeOf('function');
    });

    expectTypeOf<DocumentedCurrencyTypes>().toMatchTypeOf<DocumentedCurrencyTypes>();
  });

  it('reproduces the complete canonical EUR to CVE TypeScript example', async () => {
    const [markdown, canonicalSource] = await Promise.all([
      readFile(new URL('../../docs/examples/currency/eur-to-cve.md', import.meta.url), 'utf8'),
      readFile(new URL('../../docs/examples/currency/eur-to-cve.ts', import.meta.url), 'utf8'),
    ]);

    expect(extractTypeScriptBlock(markdown)).toBe(canonicalSource.trim());
  });

  it('runs the documented fixed-rate EUR to CVE example without network access', () => {
    expect(prepared.conversion).toMatchObject({
      sourceCurrency: 'EUR',
      targetCurrency: 'CVE',
      rate: 110.265,
      originalPayableAmount: 200,
      convertedPayableAmount: 22_053,
    });
    expect(xml).toContain('<PayableAmount>22053</PayableAmount>');
    expect(xml).toContain(
      '<PayableAlternativeAmount CurrencyCode="EUR" ExchangeRate="110.265">200</PayableAlternativeAmount>',
    );
    expect(dfa).toMatchObject({
      contentType: 'application/pdf',
      filename: `${iud}.pdf`,
    });
    expect(dfa.buffer.length).toBeGreaterThan(0);
  });
});

function extractTypeScriptBlock(markdown: string): string {
  const match = markdown.match(/```ts\n([\s\S]*?)\n```/);

  expect(match, 'Expected one TypeScript block in the currency example.').not.toBeNull();

  return match?.[1]?.trim() ?? '';
}

type DocumentedCurrencyTypes = {
  bcvOptions: BcvExchangeRateProviderOptions;
  callback: ExchangeRateCallback;
  conversion: CurrencyConversionMetadata;
  dependencies: EfaturaDependencies;
  dfaInput: DfaRenderInput;
  dfaRenderer: DfaRenderer;
  errorCode: ExchangeRateErrorCode;
  fixedOptions: FixedExchangeRateProviderOptions;
  prepared: PreparedCurrencyInvoice;
  preparationOptions: PrepareInvoiceToCveOptions;
  provider: ExchangeRateProvider;
  quote: ExchangeRateQuote;
  renderOptions: RenderDfaOptions;
  request: ExchangeRateRequest;
  rateType: ExchangeRateType;
  worldBankOptions: WorldBankExchangeRateProviderOptions;
};
