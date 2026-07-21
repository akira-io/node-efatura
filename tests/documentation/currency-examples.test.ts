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
  type ExchangeRateEvidence,
  type ExchangeRateEvidenceLeg,
  type ExchangeRateEvidenceLegRole,
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

  it('documents the final provider and metadata hardening rules', async () => {
    const [guide, apiReference, compliance, configuration] = await Promise.all([
      readFile(new URL('../../docs/18-currency-conversion.md', import.meta.url), 'utf8'),
      readFile(new URL('../../docs/12-api-reference.md', import.meta.url), 'utf8'),
      readFile(new URL('../../docs/11-compliance-matrix.md', import.meta.url), 'utf8'),
      readFile(new URL('../../docs/02-configuration.md', import.meta.url), 'utf8'),
    ]);

    expect(guide).toContain('spanning `th[colspan="5"]` publication row');
    expect(guide).toContain('fixed UTC-01 Cape Verde calendar date');
    expect(guide).toContain('positive safe integers');
    expect(guide).toContain('The `CVE` to `CPV` mapping is locked');
    expect(guide).toContain('only supported indicator is `PA.NUS.FCRF`');
    expect(guide).toContain('requires invoice totals and a payable amount');
    expect(guide).toContain('DFA conversion metadata is validated against the invoice');
    expect(guide).toContain('validation.payable_alternative_currency_unsupported');
    expect(guide).toContain('rounded to two fractional digits with half-up rounding');
    expect(guide).toContain('origin must be exactly `https://www.bcv.cv`');
    expect(guide).toContain('Redirect responses are rejected');
    expect(guide).toContain(
      'BCV requires the exact official `https://www.bcv.cv` origin. For another trusted source, use `FixedExchangeRateProvider` or `CallbackExchangeRateProvider`.',
    );
    expect(apiReference).toContain('ExchangeRateEvidence');
    expect(apiReference).toContain('validation.payable_alternative_currency_unsupported');
    expect(apiReference).toContain('exactly `https://www.bcv.cv`');
    expect(compliance).toContain('payableAlternativeAmountSchema');
    expect(configuration).toContain('exactly `https://www.bcv.cv`');
  });

  it('documents the render DFA currency deprecation contract and migration', async () => {
    const [optionsSource, changelog, apiReference, dfaGuide, troubleshooting, currencyGuide] =
      await Promise.all([
        readFile(new URL('../../src/application/efatura-options.ts', import.meta.url), 'utf8'),
        readFile(new URL('../../CHANGELOG.md', import.meta.url), 'utf8'),
        readFile(new URL('../../docs/12-api-reference.md', import.meta.url), 'utf8'),
        readFile(new URL('../../docs/14-dfa.md', import.meta.url), 'utf8'),
        readFile(new URL('../../docs/17-troubleshooting.md', import.meta.url), 'utf8'),
        readFile(new URL('../../docs/18-currency-conversion.md', import.meta.url), 'utf8'),
      ]);
    const contractDocuments = [changelog, apiReference, dfaGuide, troubleshooting, currencyGuide];

    expect(optionsSource).toContain(
      '@deprecated Use prepareInvoiceToCve() and pass invoice with conversion metadata. Removed in v1.0.0.',
    );
    for (const document of contractDocuments) {
      expect(document).toContain('EFATURA_RENDER_DFA_CURRENCY_DEPRECATED');
      expect(document).toContain('v1.0.0');
      expect(document).toContain('prepareInvoiceToCve()');
    }
    expect(dfaGuide).toContain('once per process');
    expect(currencyGuide).toContain('once per process');
    expect(dfaGuide).not.toContain('No runtime deprecation warning is emitted.');
    expect(currencyGuide).not.toContain('does not emit a deprecation warning at runtime');
  });

  it('does not use the deprecated currency option in framework examples', async () => {
    const examples = await Promise.all([
      readFile(new URL('../../docs/examples/fastify/react.md', import.meta.url), 'utf8'),
      readFile(new URL('../../docs/examples/fastify/svelte.md', import.meta.url), 'utf8'),
      readFile(new URL('../../docs/examples/fastify/vue.md', import.meta.url), 'utf8'),
    ]);

    for (const example of examples) {
      expect(example).not.toContain("options: { currency: 'CVE' }");
    }
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
  evidence: ExchangeRateEvidence;
  evidenceLeg: ExchangeRateEvidenceLeg;
  evidenceLegRole: ExchangeRateEvidenceLegRole;
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
