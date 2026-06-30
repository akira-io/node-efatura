import { describe, expect, it } from 'vitest';
import { DocumentType } from '../src/domain/enums/document-type';
import { EfaturaValidationError } from '../src/domain/errors';
import { invoiceDataFrom } from '../src/domain/value-objects/invoice-data';
import { baseInvoicePayload, referencePayload, transportRoutePayload } from './helpers';

describe('line tax requirements', () => {
  it('allows omitted line taxes for NCE, DTE, and DVE documents', () => {
    expect(() =>
      invoiceDataFrom(
        baseInvoicePayload({
          type: DocumentType.ElectronicCreditNote,
          issueReasonCode: '2',
          references: [referencePayload()],
          lines: [lineWithoutTaxes()],
          totals: zeroTaxTotals(),
        }),
      ),
    ).not.toThrow();

    expect(() =>
      invoiceDataFrom(
        baseInvoicePayload({
          type: DocumentType.ElectronicTransportDocument,
          receiver: null,
          transportDocumentTypeCode: '1',
          transportServiceProviderParty: baseInvoicePayload().emitter,
          transportRoute: transportRoutePayload(),
          lines: [lineWithoutTaxes()],
          totals: undefined,
        }),
      ),
    ).not.toThrow();

    expect(() =>
      invoiceDataFrom(
        baseInvoicePayload({
          type: DocumentType.ElectronicReturnNote,
          issueReasonCode: '0',
          references: [referencePayload()],
          lines: [lineWithoutTaxes()],
          totals: zeroTaxTotals(),
        }),
      ),
    ).not.toThrow();
  });

  it('requires line taxes for FTE documents', () => {
    try {
      invoiceDataFrom(
        baseInvoicePayload({
          lines: [lineWithoutTaxes()],
          totals: zeroTaxTotals(),
        }),
      );
      throw new Error('Expected validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(EfaturaValidationError);
      expect((error as EfaturaValidationError).field).toBe('lines.0.taxes');
    }
  });
});

function lineWithoutTaxes(): Record<string, unknown> {
  return {
    lineTypeCode: 'N',
    quantity: { value: 1, unitCode: 'EA' },
    price: 1000,
    priceExtension: 1000,
    netTotal: 1000,
    taxes: [],
    item: { description: 'Item', emitterIdentification: 'ITEM1' },
  };
}

function zeroTaxTotals(): Record<string, unknown> {
  return {
    priceExtensionTotalAmount: 1000,
    chargeTotalAmount: 0,
    discountTotalAmount: 0,
    netTotalAmount: 1000,
    taxTotalAmount: 0,
    payableAmount: 1000,
  };
}
