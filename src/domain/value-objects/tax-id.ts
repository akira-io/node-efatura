import { z } from 'zod';
import { optionalText } from '../../support/normalizers';
import { EfaturaValidationError } from '../errors';

export interface TaxIdData {
  countryCode: string;
  value: string;
}

export const CAPE_VERDE_NIF_PATTERN = /^[1-9][0-9]{8}$/;
export const CAPE_VERDE_NIF_MESSAGE =
  'Cabo Verde NIF must have 9 digits and cannot start with zero.';

export const taxIdDataSchema = z
  .object({
    countryCode: z.preprocess(normalizeCountry, z.string().length(2)),
    value: z.preprocess(normalizeOptionalText, z.string().min(5).max(20).regex(/^\S+$/)),
  })
  .superRefine((taxId, context) => {
    if (taxId.countryCode !== 'CV' || isCapeVerdeNif(taxId.value)) {
      return;
    }

    context.addIssue({
      code: 'custom',
      path: ['value'],
      message: CAPE_VERDE_NIF_MESSAGE,
    });
  });

export function isCapeVerdeNif(value: string): boolean {
  return CAPE_VERDE_NIF_PATTERN.test(value);
}

export function normalizeCapeVerdeNif(value: unknown, fieldName: string): string {
  const text = optionalText(value);

  if (text !== null && isCapeVerdeNif(text)) {
    return text;
  }

  throw new EfaturaValidationError(fieldName, CAPE_VERDE_NIF_MESSAGE, 'nif.cv_invalid');
}

export function taxIdDataFrom(value: unknown, prefix = 'taxId'): TaxIdData | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const data = value as Record<string, unknown>;
  const result = taxIdDataSchema.safeParse({
    countryCode: data.countryCode,
    value: data.value,
  });

  if (!result.success) {
    const issuePath = result.error.issues[0]?.path.join('.') ?? 'taxId';
    const issueMessage = result.error.issues[0]?.message ?? 'TaxId is invalid.';

    throw new EfaturaValidationError(field(prefix, issuePath), issueMessage, 'tax_id.invalid');
  }

  return result.data;
}

function normalizeOptionalText(value: unknown): string | null {
  return optionalText(value);
}

function normalizeCountry(value: unknown): string | null {
  return optionalText(value)?.toUpperCase() ?? null;
}

function field(prefix: string, name: string): string {
  return prefix === '' ? name : `${prefix}.${name}`;
}
