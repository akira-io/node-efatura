import { describe, expect, it } from 'vitest';
import { TaxTypeCode } from '../src/domain/enums/tax-type-code';
import { EfaturaValidationError } from '../src/domain/errors';
import { invoiceDataFrom } from '../src/domain/value-objects/invoice-data';
import { baseInvoicePayload } from './helpers';

function expectTotalsValidation(callback: () => unknown, field: string): void {
  try {
    callback();
    throw new Error('Expected validation to fail.');
  } catch (error) {
    expect(error).toBeInstanceOf(EfaturaValidationError);
    const validationError = error as EfaturaValidationError;
    expect(validationError.field).toBe(field);
    expect(validationError.message).toBe('Line amount is required for totals reconciliation.');
  }
}

function expectTotalsMismatch(callback: () => unknown, field: string): void {
  try {
    callback();
    throw new Error('Expected validation to fail.');
  } catch (error) {
    expect(error).toBeInstanceOf(EfaturaValidationError);
    const validationError = error as EfaturaValidationError;
    expect(validationError.field).toBe(field);
    expect(validationError.message).toBe('Document totals must match line amounts.');
  }
}

function linePayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    lineTypeCode: 'N',
    quantity: { value: 1, unitCode: 'EA' },
    price: 1000,
    priceExtension: 1000,
    netTotal: 1000,
    taxes: [{ taxTypeCode: TaxTypeCode.IVA, taxPercentage: 15, taxTotal: 150 }],
    item: { description: 'Item', emitterIdentification: 'ITEM1' },
    ...overrides,
  };
}

describe('totals reconciliation', () => {
  it('subtracts withholding from the payable amount', () => {
    const lines = [
      linePayload({
        taxes: [
          { taxTypeCode: TaxTypeCode.IVA, taxPercentage: 15, taxTotal: 150 },
          { taxTypeCode: TaxTypeCode.IncomeTax, taxPercentage: 10, taxTotal: 100 },
        ],
      }),
    ];

    expectTotalsMismatch(
      () =>
        invoiceDataFrom(
          baseInvoicePayload({
            lines,
            totals: {
              priceExtensionTotalAmount: 1000,
              chargeTotalAmount: 0,
              discountTotalAmount: 0,
              netTotalAmount: 1000,
              taxTotalAmount: 150,
              withholdingTaxTotalAmount: 100,
              payableAmount: 1150,
            },
          }),
        ),
      'totals.payableAmount',
    );

    expect(() =>
      invoiceDataFrom(
        baseInvoicePayload({
          lines,
          totals: {
            priceExtensionTotalAmount: 1000,
            chargeTotalAmount: 0,
            discountTotalAmount: 0,
            netTotalAmount: 1000,
            taxTotalAmount: 150,
            withholdingTaxTotalAmount: 100,
            payableAmount: 1050,
          },
        }),
      ),
    ).not.toThrow();
  });

  it('adds informational line tax while ignoring its net total', () => {
    const lines = [
      linePayload({ id: 'L1' }),
      linePayload({
        id: 'L2',
        lineTypeCode: 'I',
        price: 500,
        priceExtension: 500,
        netTotal: 500,
        taxes: [{ taxTypeCode: TaxTypeCode.IVA, taxPercentage: 15, taxTotal: 75 }],
      }),
    ];

    expectTotalsMismatch(
      () =>
        invoiceDataFrom(
          baseInvoicePayload({
            lines,
            totals: {
              priceExtensionTotalAmount: 1000,
              chargeTotalAmount: 0,
              discountTotalAmount: 0,
              netTotalAmount: 1000,
              taxTotalAmount: 150,
              payableAmount: 1150,
            },
          }),
        ),
      'totals.taxTotalAmount',
    );

    expect(() =>
      invoiceDataFrom(
        baseInvoicePayload({
          lines,
          totals: {
            priceExtensionTotalAmount: 1000,
            chargeTotalAmount: 0,
            discountTotalAmount: 0,
            netTotalAmount: 1000,
            taxTotalAmount: 225,
            payableAmount: 1225,
          },
        }),
      ),
    ).not.toThrow();
  });

  it('does not let omitted informational line tax disable document tax reconciliation', () => {
    const lines = [
      linePayload({ id: 'L1' }),
      linePayload({
        id: 'L2',
        lineTypeCode: 'I',
        price: 500,
        priceExtension: 500,
        netTotal: 500,
        taxes: [{ taxTypeCode: TaxTypeCode.IVA, taxPercentage: 15, taxTotal: null }],
      }),
    ];

    expectTotalsMismatch(
      () =>
        invoiceDataFrom(
          baseInvoicePayload({
            lines,
            totals: {
              priceExtensionTotalAmount: 1000,
              chargeTotalAmount: 0,
              discountTotalAmount: 0,
              netTotalAmount: 1000,
              taxTotalAmount: 999,
              payableAmount: 1999,
            },
          }),
        ),
      'totals.taxTotalAmount',
    );
  });

  it('requires line amounts before reconciling document totals', () => {
    expectTotalsValidation(
      () => invoiceDataFrom(baseInvoicePayload({ lines: [linePayload({ priceExtension: null })] })),
      'lines.0.priceExtension',
    );

    expectTotalsValidation(
      () => invoiceDataFrom(baseInvoicePayload({ lines: [linePayload({ netTotal: null })] })),
      'lines.0.netTotal',
    );

    expectTotalsValidation(
      () =>
        invoiceDataFrom(
          baseInvoicePayload({
            lines: [
              linePayload({
                taxes: [{ taxTypeCode: TaxTypeCode.IVA, taxPercentage: 15, taxTotal: null }],
              }),
            ],
          }),
        ),
      'lines.0.taxes.0.taxTotal',
    );
  });

  it('accepts aggregate tax rounding across invoice lines', () => {
    const lines = Array.from({ length: 10 }, () =>
      linePayload({
        price: 0.05,
        priceExtension: 0.05,
        netTotal: 0.05,
        taxes: [{ taxTypeCode: TaxTypeCode.IVA, taxPercentage: 15, taxTotal: 0.01 }],
      }),
    );

    expect(() =>
      invoiceDataFrom(
        baseInvoicePayload({
          lines,
          totals: {
            priceExtensionTotalAmount: 0.5,
            chargeTotalAmount: 0,
            discountTotalAmount: 0,
            netTotalAmount: 0.5,
            taxTotalAmount: 0.08,
            payableAmount: 0.58,
          },
        }),
      ),
    ).not.toThrow();

    expect(() =>
      invoiceDataFrom(
        baseInvoicePayload({
          lines,
          totals: {
            priceExtensionTotalAmount: 0.5,
            chargeTotalAmount: 0,
            discountTotalAmount: 0,
            netTotalAmount: 0.5,
            taxTotalAmount: 0.1,
            payableAmount: 0.6,
          },
        }),
      ),
    ).not.toThrow();
  });
});
