import { describe, expect, it } from 'vitest';
import { createEfatura } from '../src/create-efatura';
import { DocumentType } from '../src/domain/enums/document-type';
import { EfaturaValidationError } from '../src/domain/errors';
import {
  creditNoteDataFrom,
  electronicReceiptDataFrom,
  salesReceiptDataFrom,
  transportDocumentDataFrom,
} from '../src/domain/value-objects/documents';
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
        priceExtensionTotalAmount: 1000,
        netTotalAmount: 1000,
        taxTotalAmount: 150,
        payableAmount: 19000,
      },
    });

    expect(() => salesReceiptDataFrom({ invoice: payload })).not.toThrow();
  });

  it('requires receiver for sales receipt at threshold', () => {
    const payload = baseInvoicePayload({
      type: DocumentType.ElectronicSalesTicket,
      receiver: null,
      totals: {
        priceExtensionTotalAmount: 18000,
        netTotalAmount: 18000,
        taxTotalAmount: 2000,
        payableAmount: 20000,
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
      issueReasonCode: '2',
      references: [],
    });

    expectValidation(
      () => creditNoteDataFrom({ invoice: payload }),
      'invoice.references',
      'References are required for credit, debit, and return notes.',
    );
  });

  it('requires rent receipt data for receipt type renda', () => {
    const payload = baseInvoicePayload({
      type: DocumentType.ElectronicReceipt,
      receiptTypeCode: '4',
    });

    expectValidation(
      () => electronicReceiptDataFrom({ invoice: payload }),
      'invoice.rentReceipt',
      'RentReceipt is required when ReceiptTypeCode is 4.',
    );
  });

  it('requires references for customer return transport documents', () => {
    const payload = baseInvoicePayload({
      type: DocumentType.ElectronicTransportDocument,
      transportDocumentTypeCode: '5',
      transportServiceProviderParty: baseInvoicePayload().emitter,
      transportRoute: transportRoutePayload(),
      references: [],
    });

    expectValidation(
      () => transportDocumentDataFrom({ invoice: payload }),
      'invoice.references',
      'References are required for customer return transport documents.',
    );
  });

  it('requires rappel period for DRP credit notes', () => {
    const payload = baseInvoicePayload({
      type: DocumentType.ElectronicCreditNote,
      issueReasonCode: 'DRP',
      references: [
        {
          fiscalDocument: {
            value: 'CV32602081002003001234500001012345678903',
            isOldDocument: false,
          },
        },
      ],
    });

    expectValidation(
      () => creditNoteDataFrom({ invoice: payload }),
      'invoice.rappelPeriod',
      'RappelPeriod is required when IssueReasonCode is DRP.',
    );
  });

  it('requires NA tax exemption reason', () => {
    expectValidation(
      () => taxDataFrom({ taxTypeCode: 'NA', taxExemptionReasonCode: null }),
      'taxExemptionReasonCode',
      'NA tax requires an exemption reason.',
    );
  });

  it('rejects negative totals and requires party fields', () => {
    expectValidation(
      () =>
        totalsDataFrom({
          priceExtensionTotalAmount: -1,
          netTotalAmount: 0,
          taxTotalAmount: 0,
          payableAmount: 0,
        }),
      'priceExtensionTotalAmount',
      'Totals cannot be negative.',
    );

    expectValidation(() => partyDataFrom({ name: '' }), 'taxId', 'Party TaxId is required.');
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
    transmitterLed: '123',
    softwareCode: 'SW001',
    softwareName: 'Efatura Suite',
    softwareVersion: '1.0.0',
    middlewareBaseUrl: 'https://middleware.example',
  };
}

function transportRoutePayload() {
  return {
    locations: [
      {
        address: {
          countryCode: 'CV',
          addressDetail: 'Origem',
        },
        duration: {
          startDate: '2026-02-08',
          startTime: '10:30:00',
        },
        transportModeCode: '1',
      },
      {
        address: {
          countryCode: 'CV',
          addressDetail: 'Destino',
        },
        duration: {
          startDate: '2026-02-08',
          startTime: '11:30:00',
        },
        transportModeCode: '1',
      },
    ],
  };
}
