import { z } from 'zod';
import { messages } from '../../support/messages';
import { optionalText } from '../../support/normalizers';
import { TaxTypeCode, taxTypeCodeFromValue } from '../enums/tax-type-code';
import { EfaturaValidationError } from '../errors';

export type { TaxTypeCode } from '../enums/tax-type-code';

export interface TaxData {
  taxTypeCode: TaxTypeCode;
  stampTaxCode: string | null;
  taxPercentage: number | null;
  taxAmount: number | null;
  taxExemptionReasonCode: string | null;
  taxTotal: number | null;
}

export const taxDataSchema = z
  .object({
    taxTypeCode: z.preprocess(
      normalizeTaxType,
      z.enum([
        TaxTypeCode.NotApplicable,
        TaxTypeCode.IVA,
        TaxTypeCode.StampTax,
        TaxTypeCode.IncomeTax,
      ]),
    ),
    stampTaxCode: z.preprocess(
      normalizeOptionalText,
      z
        .string()
        .regex(/^[1-9]$/)
        .nullable(),
    ),
    taxPercentage: z.coerce.number().finite().gt(0).max(100).nullable(),
    taxAmount: z.coerce.number().finite().gt(0).nullable(),
    taxExemptionReasonCode: z.preprocess(normalizeOptionalText, z.string().min(1).nullable()),
    taxTotal: z.coerce.number().finite().gt(0).nullable(),
  })
  .superRefine((tax, context) => {
    if (tax.taxTypeCode === TaxTypeCode.NotApplicable && tax.taxExemptionReasonCode === null) {
      context.addIssue({
        code: 'custom',
        path: ['taxExemptionReasonCode'],
        message: messages.validation.naTaxExemptionRequired,
      });

      return;
    }

    const valueCount = [
      tax.taxPercentage !== null,
      tax.taxAmount !== null,
      tax.taxExemptionReasonCode !== null,
    ].filter(Boolean).length;

    if (valueCount !== 1) {
      context.addIssue({
        code: 'custom',
        path: ['taxPercentage'],
        message: 'Tax must contain exactly one value field.',
      });
    }

    if (tax.taxTypeCode === TaxTypeCode.StampTax && tax.stampTaxCode === null) {
      context.addIssue({
        code: 'custom',
        path: ['stampTaxCode'],
        message: 'StampTaxCode is required for stamp tax.',
      });
    }
  });

export function taxDataFrom(data: Record<string, unknown>, prefix = ''): TaxData {
  const field = (name: string): string => (prefix === '' ? name : `${prefix}.${name}`);
  const result = taxDataSchema.safeParse({
    taxTypeCode: data.taxTypeCode,
    stampTaxCode: data.stampTaxCode,
    taxPercentage: nullableNumber(data.taxPercentage),
    taxAmount: nullableNumber(data.taxAmount),
    taxExemptionReasonCode: data.taxExemptionReasonCode,
    taxTotal: nullableNumber(data.taxTotal),
  });

  if (!result.success) {
    const issuePath = result.error.issues[0]?.path.join('.') ?? 'tax';
    const issueMessage = result.error.issues[0]?.message ?? 'Tax is invalid.';

    throw new EfaturaValidationError(field(issuePath), issueMessage, 'tax.invalid');
  }

  return result.data;
}

function nullableNumber(value: unknown): unknown {
  return value === undefined || value === null || value === '' ? null : value;
}

function normalizeOptionalText(value: unknown): string | null {
  return optionalText(value);
}

function normalizeTaxType(value: unknown): TaxTypeCode | null {
  return taxTypeCodeFromValue(optionalText(value));
}
