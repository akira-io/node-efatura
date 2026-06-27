import { DocumentType } from '../src/domain/enums/document-type';

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
              taxTypeCode: 'IVA',
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
