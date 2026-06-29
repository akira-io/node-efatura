import { describe, expect, it } from 'vitest';
import { createEfatura } from '../src/create-efatura';
import { DocumentType } from '../src/domain/enums/document-type';
import { TaxTypeCode } from '../src/domain/enums/tax-type-code';
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
import { isCapeVerdeNif, taxIdDataFrom } from '../src/domain/value-objects/tax-id';
import { totalsDataFrom } from '../src/domain/value-objects/totals-data';
import {
  baseInvoicePayload,
  officialDocumentPayloads,
  referencePayload,
  transportRoutePayload,
} from './helpers';

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
    for (const payload of officialDocumentPayloads()) {
      expect(() => invoiceDataFrom(payload)).not.toThrow();
    }
  });

  it('allows sales receipt without receiver below threshold', () => {
    const payload = baseInvoicePayload({
      type: DocumentType.ElectronicSalesTicket,
      receiver: null,
      lines: [
        {
          quantity: { value: 1, unitCode: 'EA' },
          price: 16521.74,
          priceExtension: 16521.74,
          netTotal: 16521.74,
          taxes: [{ taxTypeCode: TaxTypeCode.IVA, taxPercentage: 15, taxTotal: 2478.26 }],
          item: {
            description: 'Item',
            emitterIdentification: 'ITEM1',
          },
        },
      ],
      totals: {
        priceExtensionTotalAmount: 16521.74,
        netTotalAmount: 16521.74,
        taxTotalAmount: 2478.26,
        payableAmount: 19000,
      },
    });

    expect(() => salesReceiptDataFrom({ invoice: payload })).not.toThrow();
  });

  it('requires receiver for sales receipt at threshold', () => {
    const payload = baseInvoicePayload({
      type: DocumentType.ElectronicSalesTicket,
      receiver: null,
      lines: [
        {
          quantity: { value: 1, unitCode: 'EA' },
          price: 18000,
          priceExtension: 18000,
          netTotal: 18000,
          taxes: [{ taxTypeCode: TaxTypeCode.IVA, taxPercentage: 15, taxTotal: 2000 }],
          item: {
            description: 'Item',
            emitterIdentification: 'ITEM1',
          },
        },
      ],
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
      lines: undefined,
      totals: undefined,
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
      totals: undefined,
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
            value: '1/2026/ABC/1',
            isOldDocument: true,
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
      () => taxDataFrom({ taxTypeCode: TaxTypeCode.NotApplicable, taxExemptionReasonCode: null }),
      'taxExemptionReasonCode',
      'NA tax requires an exemption reason.',
    );
  });

  it('rejects a non-NA tax carrying only an exemption reason', () => {
    expectValidation(
      () =>
        taxDataFrom({
          taxTypeCode: TaxTypeCode.IVA,
          taxExemptionReasonCode: '1',
        }),
      'taxExemptionReasonCode',
      'Tax exemption reason is only allowed for not-applicable tax.',
    );
  });

  it('rejects a NA tax carrying a percentage', () => {
    expectValidation(
      () =>
        taxDataFrom({
          taxTypeCode: TaxTypeCode.NotApplicable,
          taxExemptionReasonCode: '1',
          taxPercentage: 15,
        }),
      'taxPercentage',
      'Not-applicable tax must not contain a percentage or amount.',
    );
  });

  it('accepts an IVA tax with a percentage', () => {
    expect(() =>
      taxDataFrom({ taxTypeCode: TaxTypeCode.IVA, taxPercentage: 15, taxTotal: 150 }),
    ).not.toThrow();
  });

  it('rejects fields not allowed by the selected official document type', () => {
    expectValidation(
      () =>
        invoiceDataFrom(
          baseInvoicePayload({
            type: DocumentType.ElectronicSalesTicket,
            receiver: null,
            references: [referencePayload()],
          }),
        ),
      'references',
      'references is not allowed for this document type.',
    );

    expectValidation(
      () =>
        invoiceDataFrom(
          baseInvoicePayload({
            type: DocumentType.ElectronicDebitNote,
            issueReasonCode: '2',
            issueReasonDescription: 'Descricao nao permitida',
            references: [referencePayload()],
          }),
        ),
      'issueReasonDescription',
      'issueReasonDescription is not allowed for this document type.',
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

  it('validates Cabo Verde NIF format for CV tax ids', () => {
    expect(isCapeVerdeNif('100200300')).toBe(true);
    expect(isCapeVerdeNif('010020030')).toBe(false);
    expect(taxIdDataFrom({ countryCode: 'CV', value: '100200300' })?.value).toBe('100200300');

    expectValidation(
      () => taxIdDataFrom({ countryCode: 'CV', value: '010020030' }),
      'taxId.value',
      'Cabo Verde NIF must have 9 digits and cannot start with zero.',
    );

    expectValidation(
      () => taxIdDataFrom({ countryCode: 'CV', value: '100-200-300' }),
      'taxId.value',
      'Cabo Verde NIF must have 9 digits and cannot start with zero.',
    );

    expect(taxIdDataFrom({ countryCode: 'PT', value: 'PT12345' })?.value).toBe('PT12345');
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
