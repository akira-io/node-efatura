import { z } from 'zod';
import { optionalText } from '../../support/normalizers';
import { EfaturaValidationError } from '../errors';

export interface QuantityData {
  value: number;
  unitCode: string;
  isStandardUnitCode: boolean | null;
}

export const quantityDataSchema = z.object({
  value: z.coerce.number().finite().gt(0),
  unitCode: z.preprocess(normalizeUnitCode, z.string().min(1).max(50)),
  isStandardUnitCode: z.preprocess(optionalBoolean, z.boolean().nullable()),
});

export function quantityDataFrom(
  value: unknown,
  unitCode: unknown = 'EA',
  prefix = 'quantity',
): QuantityData {
  const result = quantityDataSchema.safeParse(normalizeQuantityInput(value, unitCode));

  if (!result.success) {
    const issuePath = result.error.issues[0]?.path.join('.') ?? 'quantity';

    throw new EfaturaValidationError(
      field(prefix, issuePath),
      'Quantity is invalid.',
      'quantity.invalid',
    );
  }

  return result.data;
}

function normalizeQuantityInput(value: unknown, unitCode: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const data = value as Record<string, unknown>;

    return {
      value: data.value ?? data.quantity,
      unitCode: data.unitCode ?? unitCode,
      isStandardUnitCode: data.isStandardUnitCode,
    };
  }

  return {
    value,
    unitCode,
    isStandardUnitCode: null,
  };
}

function normalizeUnitCode(value: unknown): string | null {
  return optionalText(value) ?? null;
}

function optionalBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return null;
}

function field(prefix: string, name: string): string {
  return prefix === '' ? name : `${prefix}.${name}`;
}
