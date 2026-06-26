import { describe, expect, it } from 'vitest';
import { createEfatura } from '../src/create-efatura';
import { DocumentType } from '../src/domain/enums/document-type';
import { EfaturaValidationError } from '../src/domain/errors';
import { creditNoteDataFrom, salesReceiptDataFrom } from '../src/domain/value-objects/documents';
import { invoiceDataFrom } from '../src/domain/value-objects/invoice-data';
import { partyDataFrom } from '../src/domain/value-objects/party-data';
import { taxDataFrom } from '../src/domain/value-objects/tax-data';
import { totalsDataFrom } from '../src/domain/value-objects/totals-data';
import { baseInvoicePayload } from './helpers';

function expectValidation(callback: () => unknown, field: string, message: string): void {
  try {
    callback();
    throw new Error('Expected validation to fail.');
  } catch (error) {
    expect(error).toBeInstanceOf(EfaturaValidationError);
    const validationError = error as EfaturaValidationError;
    expect(validationError.field).toBe(field);
    expect(validationError.message).toBe(message);
  }
}

describe('data validation', () => {
  it('validates invoice issue date', () => {
    expectValidation(
      () => invoiceDataFrom(baseInvoicePayload({ issueDate: '' })),
      'issueDate',
      'Issue date is required.',
    );
  });

  it('requires invoice lines', () => {
    expectValidation(
      () => invoiceDataFrom(baseInvoicePayload({ lines: [] })),
      'lines',
      'At least one line item is required.',
    );
  });

  it('requires receiver for non sales receipt types', () => {
    expectValidation(
      () => invoiceDataFrom(baseInvoicePayload({ receiver: null })),
      'receiver',
      'Receiver is required for this document type.',
    );
  });

  it('accepts all official v11 document types', () => {
    for (const type of [
      DocumentType.ElectronicInvoice,
      DocumentType.ElectronicInvoiceReceipt,
      DocumentType.ElectronicSalesTicket,
      DocumentType.ElectronicReceipt,
      DocumentType.ElectronicCreditNote,
      DocumentType.ElectronicDebitNote,
      DocumentType.ElectronicReturnNote,
      DocumentType.ElectronicEntryNote,
      DocumentType.ElectronicTransportDocument,
    ]) {
      expect(() => invoiceDataFrom(baseInvoicePayload({ type }))).not.toThrow();
    }
  });

  it('allows sales receipt without receiver below threshold', () => {
    const payload = baseInvoicePayload({
      type: DocumentType.ElectronicSalesTicket,
      receiver: null,
      totals: {
        subtotal: 1000,
        taxTotal: 150,
        grandTotal: 19000,
      },
    });

    expect(() => salesReceiptDataFrom({ invoice: payload })).not.toThrow();
  });

  it('requires receiver for sales receipt at threshold', () => {
    const payload = baseInvoicePayload({
      type: DocumentType.ElectronicSalesTicket,
      receiver: null,
      totals: {
        subtotal: 18000,
        taxTotal: 2000,
        grandTotal: 20000,
      },
    });

    expectValidation(
      () => salesReceiptDataFrom({ invoice: payload }),
      'invoice.receiver',
      'Receiver is required for this document type.',
    );
  });

  it('requires credit note references', () => {
    const payload = baseInvoicePayload({
      type: DocumentType.ElectronicCreditNote,
      originalIud: '',
      creditNoteReason: '',
    });

    expectValidation(
      () => creditNoteDataFrom({ invoice: payload }),
      'invoice.originalIud',
      'Original IUD is required for credit notes.',
    );
  });

  it('requires NA tax exemption reason', () => {
    expectValidation(
      () => taxDataFrom({ type: 'NA', rate: 0, amount: 0, exemptionReason: null }),
      'exemptionReason',
      'NA tax requires an exemption reason.',
    );
  });

  it('rejects negative totals and requires party fields', () => {
    expectValidation(
      () => totalsDataFrom({ subtotal: -1, taxTotal: 0, grandTotal: 0 }),
      'subtotal',
      'Totals cannot be negative.',
    );

    expectValidation(() => partyDataFrom({ nif: '', name: '' }), 'nif', 'Party NIF is required.');
  });

  it('rejects invoice type mismatch in wrappers', () => {
    expectValidation(
      () =>
        createEfatura(validConfig()).electronicInvoice({
          invoice: baseInvoicePayload({ type: DocumentType.ElectronicInvoiceReceipt }),
        }),
      'invoice.type',
      'Invoice type does not match the expected document type.',
    );
  });
});

function validConfig() {
  return {
    transmitterNif: '100200300',
    transmitterLed: 'LED123',
    softwareCode: 'SW-001',
    softwareName: 'Efatura Suite',
    softwareVersion: '1.0.0',
    middlewareBaseUrl: 'https://middleware.example',
  };
}
