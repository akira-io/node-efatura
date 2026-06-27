import { describe, expect, it } from 'vitest';
import { createEfatura } from '../src/create-efatura';
import { DocumentType } from '../src/domain/enums/document-type';
import { TaxTypeCode } from '../src/domain/enums/tax-type-code';
import { isUuid } from '../src/support/generators';

describe('Efatura facade and builder', () => {
  const config = {
    transmitterNif: '100200300',
    transmitterLed: '123',
    emitter: {
      name: 'Emitter',
      address: {
        countryCode: 'CV',
        addressDetail: 'Emitter address',
      },
      contacts: {
        email: 'issuer@example.cv',
        telephone: '5551234',
      },
    },
    softwareCode: 'SW001',
    softwareName: 'Efatura Suite',
    softwareVersion: '1.0.0',
    middlewareBaseUrl: 'https://middleware.example',
  };

  it('builds invoices with UUID document ids and configured emitters', () => {
    const efatura = createEfatura(config);

    const invoice = efatura
      .invoice()
      .type(DocumentType.ElectronicInvoice)
      .issueDate('2026-02-08')
      .receiver({ taxId: { countryCode: 'CV', value: '900800700' }, name: 'Receiver' })
      .line({
        quantity: { value: 1, unitCode: 'EA' },
        price: 1000,
        priceExtension: 1000,
        netTotal: 1000,
        taxes: [{ taxTypeCode: TaxTypeCode.IVA, taxPercentage: 15, taxTotal: 150 }],
        item: {
          description: 'Item',
          emitterIdentification: 'ITEM1',
        },
      })
      .totals({
        priceExtensionTotalAmount: 1000,
        netTotalAmount: 1000,
        taxTotalAmount: 150,
        payableAmount: 1150,
      })
      .validate();

    expect(invoice.type).toBe(DocumentType.ElectronicInvoice);
    expect(invoice.emitter.taxId?.value).toBe('100200300');
    expect(invoice.id).not.toBeNull();
    expect(isUuid(invoice.id ?? '')).toBe(true);
    expect(isUuid(efatura.generateSubmissionId())).toBe(true);
    expect(isUuid(efatura.generateBatchId())).toBe(true);
  });

  it('uses invoice emitters as overrides', () => {
    const efatura = createEfatura(config);

    const invoice = efatura
      .invoice()
      .type(DocumentType.ElectronicInvoice)
      .issueDate('2026-02-08')
      .emitter({
        taxId: { countryCode: 'CV', value: '200300400' },
        name: 'Partner Emitter',
        contacts: { email: 'partner@example.cv', telephone: '5559876' },
      })
      .receiver({ taxId: { countryCode: 'CV', value: '900800700' }, name: 'Receiver' })
      .line({
        quantity: { value: 1, unitCode: 'EA' },
        price: 1000,
        priceExtension: 1000,
        netTotal: 1000,
        taxes: [{ taxTypeCode: TaxTypeCode.IVA, taxPercentage: 15, taxTotal: 150 }],
        item: {
          description: 'Item',
          emitterIdentification: 'ITEM1',
        },
      })
      .totals({
        priceExtensionTotalAmount: 1000,
        netTotalAmount: 1000,
        taxTotalAmount: 150,
        payableAmount: 1150,
      })
      .validate();

    expect(invoice.emitter.name).toBe('Partner Emitter');
    expect(invoice.emitter.taxId?.value).toBe('200300400');
  });
});
