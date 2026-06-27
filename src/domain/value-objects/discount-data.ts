import { z } from 'zod';
import { optionalText } from '../../support/normalizers';
import { EfaturaValidationError } from '../errors';

export type DiscountValueType = 'A' | 'P';

export interface DiscountData {
  value: number;
  valueType: DiscountValueType | null;
}

export const discountDataSchema = z.object({
  value: z.coerce.number().finite().min(0),
  valueType: z.preprocess(normalizeValueType, z.enum(['A', 'P']).nullable()),
});

export function discountDataFrom(value: unknown, prefix = 'discount'): DiscountData | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const result = discountDataSchema.safeParse(normalizeDiscountInput(value));

  if (!result.success) {
    const issuePath = result.error.issues[0]?.path.join('.') ?? 'discount';

    throw new EfaturaValidationError(
      field(prefix, issuePath),
      'Discount is invalid.',
      'discount.invalid',
    );
  }

  return result.data;
}

function normalizeDiscountInput(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const data = value as Record<string, unknown>;

    return {
      value: data.value ?? data.amount,
      valueType: data.valueType ?? data.type,
    };
  }

  return {
    value,
    valueType: null,
  };
}

function normalizeValueType(value: unknown): DiscountValueType | null {
  const text = optionalText(value)?.toUpperCase();

  return text === 'A' || text === 'P' ? text : null;
}

function field(prefix: string, name: string): string {
  return prefix === '' ? name : `${prefix}.${name}`;
}
