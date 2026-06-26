import { describe, expect, it } from 'vitest';
import { createEfatura } from '../src/create-efatura';
import { DocumentType } from '../src/domain/enums/document-type';
import { isUuid } from '../src/support/generators';

describe('Efatura facade and builder', () => {
  it('builds invoices with UUID document ids', () => {
    const efatura = createEfatura({
      transmitterNif: '100200300',
      transmitterLed: 'LED123',
      softwareCode: 'SW-001',
      softwareName: 'Efatura Suite',
      softwareVersion: '1.0.0',
      middlewareBaseUrl: 'https://middleware.example',
    });

    const invoice = efatura
      .invoice()
      .type(DocumentType.ElectronicInvoice)
      .issueDate('2026-02-08')
      .emitter({ nif: '100200300', name: 'Emitter' })
      .receiver({ nif: '900800700', name: 'Receiver' })
      .line({
        description: 'Item',
        quantity: 1,
        unitPrice: 1000,
        total: 1000,
        taxes: [{ type: 'IVA', rate: 15, amount: 150 }],
      })
      .totals({ subtotal: 1000, taxTotal: 150, grandTotal: 1150 })
      .validate();

    expect(invoice.type).toBe(DocumentType.ElectronicInvoice);
    expect(invoice.id).not.toBeNull();
    expect(isUuid(invoice.id ?? '')).toBe(true);
    expect(isUuid(efatura.generateSubmissionId())).toBe(true);
    expect(isUuid(efatura.generateBatchId())).toBe(true);
  });
});
