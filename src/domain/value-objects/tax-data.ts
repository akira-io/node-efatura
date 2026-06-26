import { z } from 'zod';
import { messages } from '../../support/messages';
import { optionalText } from '../../support/normalizers';
import { EfaturaValidationError } from '../errors';

export interface TaxData {
  type: string;
  rate: number;
  amount: number;
  exemptionReason: string | null;
}

export const taxDataSchema = z
  .object({
    type: z.preprocess(normalizeOptionalText, z.string().min(1)),
    rate: z.coerce.number().finite(),
    amount: z.coerce.number().finite(),
    exemptionReason: z.preprocess(normalizeOptionalText, z.string().nullable()),
  })
  .superRefine((tax, context) => {
    if (tax.type === 'NA' && tax.exemptionReason === null) {
      context.addIssue({
        code: 'custom',
        path: ['exemptionReason'],
        message: messages.validation.naTaxExemptionRequired,
      });
    }
  });

export function taxDataFrom(data: Record<string, unknown>, prefix = ''): TaxData {
  const field = (name: string): string => (prefix === '' ? name : `${prefix}.${name}`);
  const result = taxDataSchema.safeParse({
    type: data.type,
    rate: data.rate,
    amount: data.amount,
    exemptionReason: data.exemptionReason,
  });

  if (!result.success) {
    const issuePath = result.error.issues[0]?.path.join('.');

    if (issuePath === 'type') {
      throw new EfaturaValidationError(field('type'), 'Tax type is required.', 'tax.type_required');
    }

    if (issuePath === 'rate') {
      throw new EfaturaValidationError(field('rate'), 'Tax rate is required.', 'tax.rate_required');
    }

    if (issuePath === 'amount') {
      throw new EfaturaValidationError(
        field('amount'),
        'Tax amount is required.',
        'tax.amount_required',
      );
    }

    if (issuePath === 'exemptionReason') {
      throw new EfaturaValidationError(
        field('exemptionReason'),
        messages.validation.naTaxExemptionRequired,
        'validation.na_tax_exemption_required',
      );
    }

    throw new EfaturaValidationError(field(issuePath ?? 'tax'), 'Tax is invalid.', 'tax.invalid');
  }

  return result.data;
}

function normalizeOptionalText(value: unknown): string | null {
  return optionalText(value);
}
