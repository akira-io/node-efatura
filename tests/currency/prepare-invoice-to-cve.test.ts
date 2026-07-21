import { describe, expect, it, vi } from 'vitest';
import {
  BcvExchangeRateProvider,
  createEfatura,
  DocumentType,
  EfaturaValidationError,
  ExchangeRateError,
  type ExchangeRateProvider,
  type ExchangeRateRequest,
} from '../../src';
import { baseInvoicePayload, transportRoutePayload } from '../helpers';

const config = {
  transmitterNif: '100200300',
  transmitterLed: '123',
  softwareCode: 'SW001',
  softwareName: 'Efatura Suite',
  softwareVersion: '1.0.0',
  middlewareBaseUrl: 'https://middleware.example',
};

const retrievedAt = new Date('2026-07-21T14:30:00Z');
const clock = { now: () => new Date(retrievedAt) };

describe('prepareInvoiceToCve', () => {
  it('resolves the BCV provider by default with the configured clock', () => {
    const efatura = createEfatura(config, { clock });

    expect(efatura.clock).toBe(clock);
    expect(efatura.exchangeRateProvider).toBeInstanceOf(BcvExchangeRateProvider);
  });

  it('normalizes one provider request and prepares one result', async () => {
    const getQuote = vi.fn(async (request: ExchangeRateRequest) => quoteFor(request));
    const effectiveAt = new Date('2026-07-21T12:45:00Z');
    const efatura = createEfatura(config, { clock, exchangeRateProvider: { getQuote } });

    const prepared = await efatura.prepareInvoiceToCve(baseInvoicePayload(), {
      sourceCurrency: ' eur ',
      effectiveAt,
      rateType: 'sell',
    });

    expect(getQuote).toHaveBeenCalledOnce();
    expect(getQuote).toHaveBeenCalledWith({
      sourceCurrency: 'EUR',
      targetCurrency: 'CVE',
      effectiveAt,
      rateType: 'sell',
    });
    expect(prepared.invoice.totals).toMatchObject({
      payableAmount: 126_804.75,
      payableAlternativeAmounts: [{ value: 1150, currencyCode: 'EUR', exchangeRate: 110.265 }],
    });
    expect(prepared.conversion).toMatchObject({
      sourceCurrency: 'EUR',
      targetCurrency: 'CVE',
      originalPayableAmount: 1150,
      convertedPayableAmount: 126_804.75,
    });
  });

  it('validates raw invoice records before requesting a quote', async () => {
    const getQuote = vi.fn(async (request: ExchangeRateRequest) => quoteFor(request));
    const efatura = createEfatura(config, { exchangeRateProvider: { getQuote } });

    await expect(
      efatura.prepareInvoiceToCve(baseInvoicePayload({ emitter: null }), {
        sourceCurrency: 'EUR',
      }),
    ).rejects.toMatchObject({ code: 'validation.emitter_required' });
    expect(getQuote).not.toHaveBeenCalled();
  });

  it('validates fully shaped raw records before requesting a quote', async () => {
    const getQuote = vi.fn(async (request: ExchangeRateRequest) => quoteFor(request));
    const efatura = createEfatura(config, { exchangeRateProvider: { getQuote } });
    const invalidInvoice = baseInvoicePayload({
      emitter: null,
      contingency: null,
      references: [],
      payments: null,
      extraFields: [],
    });
    const before = structuredClone(invalidInvoice);
    const preparation = efatura.prepareInvoiceToCve(invalidInvoice, { sourceCurrency: 'EUR' });

    await expect(preparation).rejects.toBeInstanceOf(EfaturaValidationError);
    await expect(preparation).rejects.toMatchObject({ code: 'validation.emitter_required' });
    expect(getQuote).not.toHaveBeenCalled();
    expect(invalidInvoice).toEqual(before);
  });

  it('reconciles accumulated line rounding before revalidating the converted invoice', async () => {
    const provider = providerAtRate(0.5);
    const efatura = createEfatura(config, { exchangeRateProvider: provider });

    const prepared = await efatura.prepareInvoiceToCve(roundingConflictPayload(), {
      sourceCurrency: 'EUR',
    });

    expect(prepared.invoice.totals).toMatchObject({
      priceExtensionTotalAmount: 0.04,
      netTotalAmount: 0.04,
      taxTotalAmount: 0.04,
      withholdingTaxTotalAmount: null,
      payableRoundingAmount: -0.04,
      payableAmount: 0.04,
      payableAlternativeAmounts: [{ value: 0.08, currencyCode: 'EUR', exchangeRate: 0.5 }],
    });
    expect(prepared.conversion).toMatchObject({
      originalPayableAmount: 0.08,
      convertedPayableAmount: 0.04,
    });
  });

  it('uses an identity quote for CVE without calling the provider or adding an alternative', async () => {
    const getQuote = vi.fn(async (request: ExchangeRateRequest) => quoteFor(request));
    const efatura = createEfatura(config, { clock, exchangeRateProvider: { getQuote } });
    const source = efatura.validateInvoice(baseInvoicePayload());

    const prepared = await efatura.prepareInvoiceToCve(source, { sourceCurrency: ' cve ' });

    expect(getQuote).not.toHaveBeenCalled();
    expect(prepared.invoice).not.toBe(source);
    expect(prepared.invoice).toEqual(source);
    expect(prepared.invoice.totals?.payableAlternativeAmounts).toEqual([]);
    expect(prepared.conversion).toMatchObject({
      sourceCurrency: 'CVE',
      targetCurrency: 'CVE',
      rate: 1,
      rateType: 'reference',
      provider: 'identity',
      retrievedAt,
      originalPayableAmount: 1150,
      convertedPayableAmount: 1150,
    });
  });

  it.each([
    'EUR',
    'CVE',
  ])('rejects %s preparation without totals before provider access', async (sourceCurrency) => {
    const getQuote = vi.fn(async (request: ExchangeRateRequest) => quoteFor(request));
    const efatura = createEfatura(config, { exchangeRateProvider: { getQuote } });

    await expect(
      efatura.prepareInvoiceToCve(invoiceWithoutTotals(), { sourceCurrency }),
    ).rejects.toMatchObject({
      code: 'exchange_rate.invoice_invalid',
      message: 'Invoice totals with a payable amount are required for currency conversion.',
    });
    expect(getQuote).not.toHaveBeenCalled();
  });

  it.each([
    '',
    'EU',
    'EURO',
    '12A',
    'AAA',
    'IDR',
    'SLE',
    'XCG',
    'ZWG',
  ])('rejects invalid source code %j before provider access', async (sourceCurrency) => {
    const getQuote = vi.fn(async (request: ExchangeRateRequest) => quoteFor(request));
    const efatura = createEfatura(config, { exchangeRateProvider: { getQuote } });

    await expect(
      efatura.prepareInvoiceToCve(baseInvoicePayload(), { sourceCurrency }),
    ).rejects.toMatchObject({ code: 'exchange_rate.currency_unsupported' });
    expect(getQuote).not.toHaveBeenCalled();
  });

  it('rejects an invalid effective date before provider access', async () => {
    const getQuote = vi.fn(async (request: ExchangeRateRequest) => quoteFor(request));
    const efatura = createEfatura(config, { exchangeRateProvider: { getQuote } });

    await expect(
      efatura.prepareInvoiceToCve(baseInvoicePayload(), {
        sourceCurrency: 'EUR',
        effectiveAt: new Date('invalid'),
      }),
    ).rejects.toMatchObject({ code: 'exchange_rate.date_invalid' });
    expect(getQuote).not.toHaveBeenCalled();
  });

  it('derives the effective instant from the invoice date and Cape Verde issue time', async () => {
    const getQuote = vi.fn(async (request: ExchangeRateRequest) => quoteFor(request));
    const efatura = createEfatura(config, { exchangeRateProvider: { getQuote } });

    await efatura.prepareInvoiceToCve(
      baseInvoicePayload({ issueDate: '2026-07-21', issueTime: '10:30:00' }),
      { sourceCurrency: 'EUR' },
    );

    expect(getQuote).toHaveBeenCalledWith(
      expect.objectContaining({ effectiveAt: new Date('2026-07-21T11:30:00.000Z') }),
    );
  });

  it('uses the configured clock time in Cape Verde when the invoice has no issue time', async () => {
    const getQuote = vi.fn(async (request: ExchangeRateRequest) => quoteFor(request));
    const boundaryClock = { now: () => new Date('2026-01-02T00:15:30.456Z') };
    const efatura = createEfatura(config, {
      clock: boundaryClock,
      exchangeRateProvider: { getQuote },
    });

    await efatura.prepareInvoiceToCve(
      baseInvoicePayload({ issueDate: '2026-07-21', issueTime: undefined }),
      { sourceCurrency: 'EUR' },
    );

    expect(getQuote).toHaveBeenCalledWith(
      expect.objectContaining({ effectiveAt: new Date('2026-07-22T00:15:30.456Z') }),
    );
  });

  it('preserves provider errors', async () => {
    const error = new ExchangeRateError(
      'exchange_rate.provider_unavailable',
      'The accounting rate service is unavailable.',
    );
    const provider: ExchangeRateProvider = {
      getQuote: vi.fn(async () => {
        throw error;
      }),
    };
    const efatura = createEfatura(config, { exchangeRateProvider: provider });

    await expect(
      efatura.prepareInvoiceToCve(baseInvoicePayload(), { sourceCurrency: 'EUR' }),
    ).rejects.toBe(error);
  });
});

function providerAtRate(rate: number): ExchangeRateProvider {
  return { getQuote: async (request) => quoteFor(request, rate) };
}

function quoteFor(request: ExchangeRateRequest, rate = 110.265) {
  return {
    ...request,
    rate,
    rateType: request.rateType ?? ('buy' as const),
    effectiveAt: new Date(request.effectiveAt),
    retrievedAt,
    provider: 'Test provider',
    sourceUrl: 'https://rates.example/quote',
  };
}

function roundingConflictPayload(): Record<string, unknown> {
  const line = {
    lineTypeCode: 'N',
    quantity: { value: 1, unitCode: 'EA' },
    price: 0.01,
    priceExtension: 0.01,
    netTotal: 0.01,
    taxes: [{ taxTypeCode: 'IVA', taxPercentage: 15, taxTotal: 0.01 }],
    item: { description: 'Item', emitterIdentification: 'ITEM' },
  };

  return baseInvoicePayload({
    lines: Array.from({ length: 4 }, () => structuredClone(line)),
    totals: {
      priceExtensionTotalAmount: 0.04,
      chargeTotalAmount: 0,
      discountTotalAmount: 0,
      netTotalAmount: 0.04,
      taxTotalAmount: 0.04,
      payableAmount: 0.08,
    },
  });
}

function invoiceWithoutTotals(): Record<string, unknown> {
  return baseInvoicePayload({
    type: DocumentType.ElectronicTransportDocument,
    receiver: null,
    receiverTypeCode: '1',
    transportDocumentTypeCode: '1',
    transportServiceProviderParty: baseInvoicePayload().emitter,
    transportRoute: transportRoutePayload(),
    totals: undefined,
  });
}
