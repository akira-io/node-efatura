import { describe, expect, it } from 'vitest';
import { assertContingencyMatchesEmissionMode } from '../src/application/contingency-validation';
import { DocumentType } from '../src/domain/enums/document-type';
import { EmissionMode } from '../src/domain/enums/emission-mode';
import { TaxTypeCode } from '../src/domain/enums/tax-type-code';
import { EfaturaValidationError } from '../src/domain/errors';
import { invoiceDataFrom } from '../src/domain/value-objects/invoice-data';
import { quantityDataFrom } from '../src/domain/value-objects/quantity-data';
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

describe('official v11 fiscal rules', () => {
  it('requires emitter email and telephone or mobilephone', () => {
    expectValidation(
      () =>
        invoiceDataFrom(
          baseInvoicePayload({
            emitter: { contacts: { email: null, mobilephone: null, telephone: '5551234' } },
          }),
        ),
      'emitter.contacts.email',
      'Emitter email is required.',
    );

    expectValidation(
      () =>
        invoiceDataFrom(
          baseInvoicePayload({
            emitter: {
              contacts: { email: 'issuer@example.cv', mobilephone: null, telephone: null },
            },
          }),
        ),
      'emitter.contacts.telephone',
      'Emitter telephone or mobilephone is required.',
    );
  });

  it('requires positive quantities', () => {
    expectValidation(
      () => quantityDataFrom({ value: 0, unitCode: 'EA' }),
      'quantity.value',
      'Quantity is invalid.',
    );
  });

  it('requires unique line ids and existing charge references', () => {
    expectValidation(
      () =>
        invoiceDataFrom(
          baseInvoicePayload({
            lines: [linePayload({ id: 'L1' }), linePayload({ id: 'L1' })],
            totals: totalsPayload({
              netTotalAmount: 2000,
              taxTotalAmount: 300,
              payableAmount: 2300,
            }),
          }),
        ),
      'lines.1.id',
      'Line id must be unique in the document.',
    );

    expectValidation(
      () =>
        invoiceDataFrom(
          baseInvoicePayload({
            lines: [
              linePayload({ id: 'L1' }),
              linePayload({ lineTypeCode: 'C', lineReferenceId: 'L9' }),
            ],
            totals: totalsPayload({
              netTotalAmount: 2000,
              taxTotalAmount: 300,
              payableAmount: 2300,
            }),
          }),
        ),
      'lines.1.lineReferenceId',
      'LineReferenceId must reference an existing line id.',
    );
  });

  it('requires line taxes where the official document type requires them', () => {
    expectValidation(
      () =>
        invoiceDataFrom(
          baseInvoicePayload({
            lines: [linePayload({ taxes: [] })],
            totals: totalsPayload({ taxTotalAmount: 0, payableAmount: 1000 }),
          }),
        ),
      'lines.0.taxes',
      'Line tax is required for this document type.',
    );

    expect(() =>
      invoiceDataFrom(
        baseInvoicePayload({
          type: DocumentType.ElectronicCreditNote,
          issueReasonCode: '2',
          references: [{ fiscalDocument: { value: '1/2026/ABC/1', isOldDocument: true } }],
          lines: [linePayload({ taxes: [] })],
          totals: totalsPayload({ taxTotalAmount: 0, payableAmount: 1000 }),
        }),
      ),
    ).not.toThrow();
  });

  it('requires totals to match line amounts', () => {
    expectValidation(
      () =>
        invoiceDataFrom(
          baseInvoicePayload({
            totals: totalsPayload({ payableAmount: 999 }),
          }),
        ),
      'totals.payableAmount',
      'Document totals must match line amounts.',
    );
  });

  it('subtracts deduction (D) lines from totals', () => {
    const lines = [
      linePayload({ id: 'L1' }),
      linePayload({
        id: 'L2',
        lineTypeCode: 'D',
        price: 200,
        priceExtension: 200,
        netTotal: 200,
        taxes: [{ taxTypeCode: TaxTypeCode.IVA, taxPercentage: 15, taxTotal: 30 }],
      }),
    ];

    expect(() =>
      invoiceDataFrom(
        baseInvoicePayload({
          lines,
          totals: totalsPayload({
            priceExtensionTotalAmount: 800,
            netTotalAmount: 800,
            taxTotalAmount: 120,
            payableAmount: 920,
          }),
        }),
      ),
    ).not.toThrow();

    expectValidation(
      () =>
        invoiceDataFrom(
          baseInvoicePayload({
            lines,
            totals: totalsPayload({
              priceExtensionTotalAmount: 1200,
              netTotalAmount: 1200,
              taxTotalAmount: 180,
              payableAmount: 1380,
            }),
          }),
        ),
      'totals.priceExtensionTotalAmount',
      'Document totals must match line amounts.',
    );
  });

  it('requires contingency fields tied to emission mode', () => {
    const offlineInvoice = invoiceDataFrom(
      baseInvoicePayload({
        contingency: {
          ledCode: '123',
          issueDate: '2026-02-08',
          reasonTypeCode: '4',
        },
      }),
    );

    expectValidation(
      () => assertContingencyMatchesEmissionMode(offlineInvoice, EmissionMode.Offline),
      'contingency.issueTime',
      'Contingency IssueTime is required in Offline mode.',
    );

    const offInvoice = invoiceDataFrom(
      baseInvoicePayload({
        contingency: {
          ledCode: '123',
          issueDate: '2026-02-08',
          issueTime: '10:30:00',
          reasonTypeCode: '0',
        },
      }),
    );

    expectValidation(
      () => assertContingencyMatchesEmissionMode(offInvoice, EmissionMode.Off),
      'contingency.iuc',
      'Contingency IUC is required in Off mode.',
    );
  });

  it('requires a contingency LedCode in contingency modes', () => {
    const invoice = invoiceDataFrom(
      baseInvoicePayload({
        contingency: {
          issueDate: '2026-02-08',
          issueTime: '10:30:00',
          reasonTypeCode: '4',
        },
      }),
    );

    expectValidation(
      () => assertContingencyMatchesEmissionMode(invoice, EmissionMode.Offline),
      'contingency.ledCode',
      'Contingency LedCode is required.',
    );
  });
});

function linePayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    lineTypeCode: 'N',
    quantity: { value: 1, unitCode: 'EA' },
    price: 1000,
    priceExtension: 1000,
    netTotal: 1000,
    taxes: [{ taxTypeCode: TaxTypeCode.IVA, taxPercentage: 15, taxTotal: 150 }],
    item: {
      description: 'Item',
      emitterIdentification: 'ITEM1',
    },
    ...overrides,
  };
}

function totalsPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    priceExtensionTotalAmount: 1000,
    chargeTotalAmount: 0,
    discountTotalAmount: 0,
    netTotalAmount: 1000,
    taxTotalAmount: 150,
    payableAmount: 1150,
    ...overrides,
  };
}
