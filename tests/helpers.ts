import { DocumentType } from '../src/domain/enums/document-type';
import { TaxTypeCode } from '../src/domain/enums/tax-type-code';

export function baseInvoicePayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return deepMerge(
    {
      type: DocumentType.ElectronicInvoice,
      issueDate: '2026-02-08',
      issueTime: '10:30:00',
      emitter: {
        taxId: {
          countryCode: 'CV',
          value: '100200300',
        },
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
      receiver: {
        taxId: {
          countryCode: 'CV',
          value: '900800700',
        },
        name: 'Receiver',
        address: {
          countryCode: 'CV',
          addressDetail: 'Receiver address',
        },
        contacts: {
          email: 'receiver@example.cv',
          telephone: '5554321',
        },
      },
      lines: [
        {
          lineTypeCode: 'N',
          quantity: {
            value: 1,
            unitCode: 'EA',
          },
          price: 1000,
          priceExtension: 1000,
          netTotal: 1000,
          taxes: [
            {
              taxTypeCode: TaxTypeCode.IVA,
              taxPercentage: 15,
              taxTotal: 150,
            },
          ],
          item: {
            description: 'Item',
            emitterIdentification: 'ITEM1',
          },
        },
      ],
      totals: {
        priceExtensionTotalAmount: 1000,
        chargeTotalAmount: 0,
        discountTotalAmount: 0,
        netTotalAmount: 1000,
        taxTotalAmount: 150,
        payableAmount: 1150,
      },
    },
    overrides,
  );
}

export function officialDocumentPayloads(): Record<string, unknown>[] {
  return generatedDocumentPayloads().map(([, payload]) => payload);
}

export function generatedDocumentPayloads(): Array<
  [DocumentType, Record<string, unknown>, number]
> {
  return [
    [
      DocumentType.ElectronicInvoice,
      baseInvoicePayload({ type: DocumentType.ElectronicInvoice }),
      1,
    ],
    [
      DocumentType.ElectronicInvoiceReceipt,
      baseInvoicePayload({ type: DocumentType.ElectronicInvoiceReceipt }),
      2,
    ],
    [
      DocumentType.ElectronicSalesTicket,
      baseInvoicePayload({ type: DocumentType.ElectronicSalesTicket, receiver: null }),
      3,
    ],
    [
      DocumentType.ElectronicReceipt,
      baseInvoicePayload({
        type: DocumentType.ElectronicReceipt,
        receiptTypeCode: '1',
        lines: undefined,
        totals: undefined,
      }),
      4,
    ],
    [
      DocumentType.ElectronicCreditNote,
      baseInvoicePayload({
        type: DocumentType.ElectronicCreditNote,
        issueReasonCode: '2',
        references: [referencePayload()],
      }),
      5,
    ],
    [
      DocumentType.ElectronicDebitNote,
      baseInvoicePayload({
        type: DocumentType.ElectronicDebitNote,
        issueReasonCode: '2',
        references: [referencePayload()],
      }),
      6,
    ],
    [
      DocumentType.ElectronicTransportDocument,
      baseInvoicePayload({
        type: DocumentType.ElectronicTransportDocument,
        receiver: null,
        transportDocumentTypeCode: '1',
        transportServiceProviderParty: baseInvoicePayload().emitter,
        transportRoute: transportRoutePayload(),
        totals: undefined,
      }),
      7,
    ],
    [
      DocumentType.ElectronicReturnNote,
      baseInvoicePayload({
        type: DocumentType.ElectronicReturnNote,
        receiver: null,
        issueReasonCode: '0',
        references: [referencePayload()],
      }),
      8,
    ],
    [
      DocumentType.ElectronicEntryNote,
      baseInvoicePayload({ type: DocumentType.ElectronicEntryNote }),
      9,
    ],
  ];
}

export function referencePayload() {
  return {
    fiscalDocument: {
      value: '1/2026/ABC/1',
      isOldDocument: true,
    },
  };
}

export function transportRoutePayload() {
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

function deepMerge(
  base: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const output: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(overrides)) {
    const current = output[key];

    if (isPlainRecord(current) && isPlainRecord(value)) {
      output[key] = deepMerge(current, value);
      continue;
    }

    output[key] = value;
  }

  return output;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
