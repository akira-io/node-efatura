import { describe, expect, it } from 'vitest';
import { TaxTypeCode } from '../src/domain/enums/tax-type-code';
import { EfaturaValidationError } from '../src/domain/errors';
import { invoiceDataFrom } from '../src/domain/value-objects/invoice-data';
import { baseInvoicePayload } from './helpers';

describe('REMPE tax rules', () => {
  it('rejects IVA taxes on REMPE invoices', () => {
    expect(() =>
      invoiceDataFrom(baseInvoicePayload({ emitter: { fiscalFramework: 'REMPE' } })),
    ).toThrow(EfaturaValidationError);

    try {
      invoiceDataFrom(baseInvoicePayload({ emitter: { fiscalFramework: 'REMPE' } }));
    } catch (error) {
      const validationError = error as EfaturaValidationError;

      expect(validationError.field).toBe('lines.0.taxes.0.taxTypeCode');
      expect(validationError.message).toBe('REMPE emitter invoices must use NA tax code.');
    }
  });

  it('accepts NA taxes on REMPE invoices', () => {
    expect(() =>
      invoiceDataFrom(
        baseInvoicePayload({
          emitter: { fiscalFramework: 'rempe' },
          lines: [
            lineWithTax({ taxTypeCode: TaxTypeCode.NotApplicable, taxExemptionReasonCode: 'M01' }),
          ],
          totals: {
            priceExtensionTotalAmount: 1000,
            chargeTotalAmount: 0,
            discountTotalAmount: 0,
            netTotalAmount: 1000,
            taxTotalAmount: 0,
            payableAmount: 1000,
          },
        }),
      ),
    ).not.toThrow();
  });

  it('accepts IVA taxes on non-REMPE invoices', () => {
    expect(() => invoiceDataFrom(baseInvoicePayload())).not.toThrow();
  });
});

function lineWithTax(tax: Record<string, unknown>): Record<string, unknown> {
  return {
    lineTypeCode: 'N',
    quantity: {
      value: 1,
      unitCode: 'EA',
    },
    price: 1000,
    priceExtension: 1000,
    netTotal: 1000,
    taxes: [tax],
    item: {
      description: 'Item',
      emitterIdentification: 'ITEM1',
    },
  };
}
