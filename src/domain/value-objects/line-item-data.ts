import { z } from 'zod';
import { isRecord, optionalText } from '../../support/normalizers';
import { EfaturaValidationError } from '../errors';
import { type TaxData, taxDataFrom } from './tax-data';

export interface LineItemData {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  taxes: TaxData[];
}

export const lineItemDataSchema = z.object({
  description: z.preprocess(normalizeOptionalText, z.string().min(1)),
  quantity: z.coerce.number().finite(),
  unitPrice: z.coerce.number().finite(),
  total: z.coerce.number().finite(),
  taxes: z.array(z.record(z.string(), z.unknown())).default([]),
});

export function lineItemDataFrom(data: Record<string, unknown>, prefix = ''): LineItemData {
  const field = (name: string): string => (prefix === '' ? name : `${prefix}.${name}`);
  const result = lineItemDataSchema.safeParse({
    description: data.description,
    quantity: data.quantity,
    unitPrice: data.unitPrice,
    total: data.total,
    taxes: Array.isArray(data.taxes) ? data.taxes.filter(isRecord) : [],
  });

  if (!result.success) {
    const issuePath = result.error.issues[0]?.path.join('.');

    if (issuePath === 'description') {
      throw new EfaturaValidationError(
        field('description'),
        'Line item description is required.',
        'line_item.description_required',
      );
    }

    if (issuePath === 'quantity') {
      throw new EfaturaValidationError(
        field('quantity'),
        'Line item quantity is required.',
        'line_item.quantity_required',
      );
    }

    if (issuePath === 'unitPrice') {
      throw new EfaturaValidationError(
        field('unitPrice'),
        'Line item unit price is required.',
        'line_item.unit_price_required',
      );
    }

    if (issuePath === 'total') {
      throw new EfaturaValidationError(
        field('total'),
        'Line item total is required.',
        'line_item.total_required',
      );
    }

    throw new EfaturaValidationError(
      field(issuePath ?? 'line'),
      'Line item is invalid.',
      'line_item.invalid',
    );
  }

  return {
    description: result.data.description,
    quantity: result.data.quantity,
    unitPrice: result.data.unitPrice,
    total: result.data.total,
    taxes: result.data.taxes.map((tax, index) => taxDataFrom(tax, field(`taxes.${index}`))),
  };
}

function normalizeOptionalText(value: unknown): string | null {
  return optionalText(value);
}
