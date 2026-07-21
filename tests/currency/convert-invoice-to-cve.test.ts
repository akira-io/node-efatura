import { describe, expect, it } from 'vitest';
import { convertInvoiceToCve } from '../../src/application/currency/convert-invoice-to-cve';
import { ExchangeRateError } from '../../src/domain/currency/exchange-rate-error';
import { TaxTypeCode } from '../../src/domain/enums/tax-type-code';
import { invoiceDataFrom } from '../../src/domain/value-objects/invoice-data';
import { baseInvoicePayload } from '../helpers';

const quote = {
  sourceCurrency: 'EUR',
  targetCurrency: 'CVE',
  rate: 110.265,
  rateType: 'buy' as const,
  effectiveAt: new Date('2026-07-21T00:00:00Z'),
  retrievedAt: new Date('2026-07-21T12:00:00Z'),
  provider: 'Banco de Cabo Verde',
  sourceUrl: 'https://www.bcv.cv/rates',
};

describe('convertInvoiceToCve', () => {
  it('converts every first-class monetary field without mutating the source invoice', () => {
    const source = conversionSource();
    const before = structuredClone(source);

    const prepared = convertInvoiceToCve(source, quote);

    expect(prepared.invoice.lines[0]).toMatchObject({
      price: 110.27,
      priceExtension: 220.53,
      netTotal: 198.48,
      discount: { value: 22.05, valueType: 'A' },
      taxes: [
        { taxPercentage: 15, taxAmount: null, taxTotal: 22.05 },
        { taxPercentage: null, taxAmount: 11.03, taxTotal: 11.03 },
      ],
    });
    expect(prepared.invoice.lines[0]?.quantity).toEqual(source.lines[0]?.quantity);
    expect(prepared.invoice.references[0]).toMatchObject({
      paymentAmount: 110.27,
      tax: { taxAmount: 11.03, taxTotal: 11.03 },
    });
    expect(prepared.invoice.payments?.payments[0]?.paymentAmount).toBe(242.58);
    expect(prepared.invoice.totals).toMatchObject({
      priceExtensionTotalAmount: 220.53,
      chargeTotalAmount: 33.08,
      discountTotalAmount: 22.05,
      netTotalAmount: 198.48,
      discount: { value: 11.03, valueType: 'A' },
      taxTotalAmount: 22.05,
      withholdingTaxTotalAmount: 11.03,
      payableRoundingAmount: 33.08,
      payableAmount: 242.58,
      payableAlternativeAmounts: [{ value: 2.2, currencyCode: 'EUR', exchangeRate: 110.265 }],
    });
    expect(prepared.invoice.extraFields).toEqual(source.extraFields);
    expect(prepared.conversion).toMatchObject({
      ...quote,
      originalPayableAmount: 2.2,
      convertedPayableAmount: 242.58,
    });
    expect(source).toEqual(before);
  });

  it('does not convert percentage discounts', () => {
    const source = conversionSource();
    const line = required(source.lines[0]);
    const totals = required(source.totals);
    line.discount = { value: 10, valueType: 'P' };
    totals.discount = { value: 5, valueType: 'P' };

    const prepared = convertInvoiceToCve(source, quote);

    expect(prepared.invoice.lines[0]?.discount).toEqual({ value: 10, valueType: 'P' });
    expect(prepared.invoice.totals?.discount).toEqual({ value: 5, valueType: 'P' });
  });

  it('preserves null monetary values', () => {
    const source = conversionSource();
    const line = required(source.lines[0]);
    const reference = required(source.references[0]);
    const payments = required(source.payments);
    const payment = required(payments.payments[0]);
    const tax = required(line.taxes[0]);
    const referenceTax = required(reference.tax);

    source.lines[0] = {
      ...line,
      price: null,
      priceExtension: null,
      discount: null,
      netTotal: null,
      taxes: [{ ...tax, taxAmount: null, taxTotal: null }],
    };
    source.references = [
      {
        ...reference,
        paymentAmount: null,
        tax: { ...referenceTax, taxAmount: null, taxTotal: null },
      },
    ];
    source.payments = {
      ...payments,
      payments: [{ ...payment, paymentAmount: null }],
    };

    const prepared = convertInvoiceToCve(source, quote);

    expect(prepared.invoice.lines[0]).toMatchObject({
      price: null,
      priceExtension: null,
      discount: null,
      netTotal: null,
      taxes: [{ taxAmount: null, taxTotal: null }],
    });
    expect(prepared.invoice.references[0]).toMatchObject({
      paymentAmount: null,
      tax: { taxAmount: null, taxTotal: null },
    });
    expect(prepared.invoice.payments?.payments[0]?.paymentAmount).toBeNull();
    expect(prepared.conversion).toMatchObject({
      originalPayableAmount: 2.2,
      convertedPayableAmount: 242.58,
    });
  });

  it('rejects conversion when invoice totals are absent', () => {
    const source = conversionSource();
    source.totals = null;

    expect(() => convertInvoiceToCve(source, quote)).toThrowError(
      expect.objectContaining({
        code: 'exchange_rate.invoice_invalid',
        message: 'Invoice totals with a payable amount are required for currency conversion.',
      }),
    );
  });

  it('preserves absent payable rounding when the converted fiscal totals reconcile exactly', () => {
    const source = conversionSource();
    required(source.totals).payableRoundingAmount = null;
    required(source.totals).payableAmount = 1.9;

    const prepared = convertInvoiceToCve(source, quote);

    expect(prepared.invoice.totals?.payableRoundingAmount).toBeNull();
  });

  it('reconciles deduction, informational, discount, and withholding line amounts', () => {
    const source = signedLineConversionSource();
    const before = structuredClone(source);

    const prepared = convertInvoiceToCve(source, { ...quote, rate: 0.5 });

    expect(prepared.invoice.lines[0]?.discount).toEqual({ value: 0.01, valueType: 'A' });
    expect(prepared.invoice.totals).toMatchObject({
      priceExtensionTotalAmount: 0.01,
      netTotalAmount: 0,
      taxTotalAmount: 0.01,
      withholdingTaxTotalAmount: 0.01,
      payableRoundingAmount: 0.01,
      payableAmount: 0.01,
      payableAlternativeAmounts: [{ value: 0.01, currencyCode: 'EUR', exchangeRate: 0.5 }],
    });
    expect(source).toEqual(before);
  });

  it('treats discounts with no value type as amounts', () => {
    const source = conversionSource();
    required(source.lines[0]).discount = { value: 0.2, valueType: null };
    required(source.totals).discount = { value: 0.1, valueType: null };

    const prepared = convertInvoiceToCve(source, quote);

    expect(prepared.invoice.lines[0]?.discount).toEqual({ value: 22.05, valueType: null });
    expect(prepared.invoice.totals?.discount).toEqual({ value: 11.03, valueType: null });
  });

  it('rejects source invoices that already contain alternative payable amounts', () => {
    const source = conversionSource();
    required(source.totals).payableAlternativeAmounts = [
      { value: 2.2, currencyCode: 'USD', exchangeRate: 1.1 },
    ];

    expect(() => convertInvoiceToCve(source, quote)).toThrowError(
      expect.objectContaining({ code: 'exchange_rate.alternatives_conflict' }),
    );
    expect(() => convertInvoiceToCve(source, quote)).toThrowError(ExchangeRateError);
  });
});

function conversionSource() {
  return invoiceDataFrom(
    baseInvoicePayload({
      lines: [
        {
          lineTypeCode: 'N',
          quantity: { value: 2, unitCode: 'EA' },
          price: 1,
          priceExtension: 2,
          discount: { value: 0.2, valueType: 'A' },
          netTotal: 1.8,
          taxes: [
            { taxTypeCode: TaxTypeCode.IVA, taxPercentage: 15, taxTotal: 0.2 },
            { taxTypeCode: TaxTypeCode.IncomeTax, taxAmount: 0.1, taxTotal: 0.1 },
          ],
          item: { description: 'Item', emitterIdentification: 'ITEM1' },
        },
      ],
      totals: {
        priceExtensionTotalAmount: 2,
        chargeTotalAmount: 0.3,
        discountTotalAmount: 0.2,
        netTotalAmount: 1.8,
        discount: { value: 0.1, valueType: 'A' },
        taxTotalAmount: 0.2,
        withholdingTaxTotalAmount: 0.1,
        payableRoundingAmount: 0.3,
        payableAmount: 2.2,
      },
      references: [
        {
          fiscalDocument: { value: '1/2026/ABC/1', isOldDocument: true },
          paymentAmount: 1,
          tax: { taxTypeCode: TaxTypeCode.IncomeTax, taxAmount: 0.1, taxTotal: 0.1 },
        },
      ],
      payments: {
        paymentDueDate: '2026-02-10',
        paymentTermsNote: 'Payment due within two days.',
        payments: [
          {
            paymentMeansCode: '1',
            paymentReference: 'PAY-1',
            paymentDate: '2026-02-10',
            paymentAmount: 2.2,
            payeeFinancialAccount: { accountNumber: '123456789', name: 'Account holder' },
          },
        ],
      },
      extraFields: [{ name: 'SourceAmount', value: 2.2, attributes: { Currency: 'EUR' } }],
    }),
  );
}

function signedLineConversionSource() {
  return invoiceDataFrom(
    baseInvoicePayload({
      lines: [
        {
          lineTypeCode: 'N',
          quantity: { value: 1, unitCode: 'EA' },
          priceExtension: 0.03,
          discount: { value: 0.01, valueType: 'A' },
          netTotal: 0.02,
          taxes: taxesWithAmount(0.01),
          item: { description: 'Net line', emitterIdentification: 'NET' },
        },
        {
          lineTypeCode: 'D',
          quantity: { value: 1, unitCode: 'EA' },
          priceExtension: 0.01,
          netTotal: 0.01,
          taxes: taxesWithAmount(0.01),
          item: { description: 'Deduction line', emitterIdentification: 'DEDUCTION' },
        },
        {
          lineTypeCode: 'I',
          quantity: { value: 1, unitCode: 'EA' },
          priceExtension: 50,
          netTotal: 50,
          taxes: taxesWithAmount(0.02),
          item: { description: 'Informational line', emitterIdentification: 'INFO' },
        },
      ],
      totals: {
        priceExtensionTotalAmount: 0.02,
        chargeTotalAmount: 0,
        discountTotalAmount: 0.01,
        netTotalAmount: 0.01,
        taxTotalAmount: 0.02,
        withholdingTaxTotalAmount: 0.02,
        payableAmount: 0.01,
      },
    }),
  );
}

function taxesWithAmount(taxAmount: number) {
  return [
    { taxTypeCode: TaxTypeCode.IVA, taxAmount, taxTotal: taxAmount },
    { taxTypeCode: TaxTypeCode.IncomeTax, taxAmount, taxTotal: taxAmount },
  ];
}

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('Test fixture is missing a required value.');
  }

  return value;
}
