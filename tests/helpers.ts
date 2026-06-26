import { DocumentType } from '../src/domain/enums/document-type';

export function baseInvoicePayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return deepMerge(
    {
      type: DocumentType.ElectronicInvoice,
      issueDate: '2026-02-08',
      emitter: {
        nif: '100200300',
        name: 'Emitter',
      },
      receiver: {
        nif: '900800700',
        name: 'Receiver',
      },
      lines: [
        {
          description: 'Item',
          quantity: 1,
          unitPrice: 1000,
          total: 1000,
          taxes: [
            {
              type: 'IVA',
              rate: 15,
              amount: 150,
            },
          ],
        },
      ],
      totals: {
        subtotal: 1000,
        taxTotal: 150,
        grandTotal: 1150,
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
