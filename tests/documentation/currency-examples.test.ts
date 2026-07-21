import { readFile } from 'node:fs/promises';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  BcvExchangeRateProvider,
  type BcvExchangeRateProviderOptions,
  CallbackExchangeRateProvider,
  type CurrencyConversionMetadata,
  createEfatura,
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

  it('runs the documented fixed-rate EUR to CVE example without network access', async () => {
    const example = await readFile(
      new URL('../../docs/examples/currency/eur-to-cve.md', import.meta.url),
      'utf8',
    );
    const effectiveAt = new Date('2026-07-21T00:00:00.000Z');
    const efatura = createEfatura(config, {
      clock: { now: () => new Date('2026-07-21T12:00:00.000Z') },
      exchangeRateProvider: new FixedExchangeRateProvider({
        sourceCurrency: 'EUR',
        targetCurrency: 'CVE',
        rate: 110.265,
        effectiveAt,
        provider: 'Rate approved by the accounting team',
        sourceUrl: 'https://internal.example/rates/2026-07-21',
      }),
    });

    const prepared = await efatura.prepareInvoiceToCve(invoiceInEur, {
      sourceCurrency: 'EUR',
    });
    const xml = efatura.buildDfeXml(prepared.invoice, { iud });
    const dfa = await efatura.renderDfa({
      iud,
      invoice: prepared.invoice,
      conversion: prepared.conversion,
    });

    expect(example).toContain("sourceCurrency: 'EUR'");
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

const config = {
  transmitterNif: '100200300',
  transmitterLed: '123',
  softwareCode: 'SW001',
  softwareName: 'Efatura Suite',
  softwareVersion: '1.0.0',
  middlewareBaseUrl: 'https://middleware.example',
};

const invoiceInEur = {
  type: 'FTE',
  issueDate: '2026-07-21',
  issueTime: '11:30:00',
  serie: 'SER-F',
  emitter: {
    taxId: { countryCode: 'CV', value: '100200300' },
    name: 'Emitter',
    address: { countryCode: 'CV', addressDetail: 'Praia' },
    contacts: { email: 'issuer@example.cv', telephone: '2600000' },
  },
  receiver: {
    taxId: { countryCode: 'CV', value: '900800700' },
    name: 'Receiver',
    address: { countryCode: 'CV', addressDetail: 'Mindelo' },
    contacts: { email: 'receiver@example.cv', telephone: '2300000' },
  },
  lines: [
    {
      lineTypeCode: 'N',
      quantity: { value: 1, unitCode: 'EA' },
      price: 173.91,
      priceExtension: 173.91,
      netTotal: 173.91,
      taxes: [{ taxTypeCode: 'IVA', taxPercentage: 15, taxTotal: 26.09 }],
      item: { description: 'Service', emitterIdentification: 'SERV-001' },
    },
  ],
  totals: {
    priceExtensionTotalAmount: 173.91,
    chargeTotalAmount: 0,
    discountTotalAmount: 0,
    netTotalAmount: 173.91,
    taxTotalAmount: 26.09,
    payableAmount: 200,
  },
};
