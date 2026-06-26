import { z } from 'zod';
import { messages } from '../../support/messages';
import { EfaturaValidationError } from '../errors';

export interface TotalsData {
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
}

export const totalsDataSchema = z.object({
  subtotal: z.coerce.number().finite().min(0),
  taxTotal: z.coerce.number().finite().min(0),
  grandTotal: z.coerce.number().finite().min(0),
});

export function totalsDataFrom(data: Record<string, unknown>, prefix = ''): TotalsData {
  const field = (name: string): string => (prefix === '' ? name : `${prefix}.${name}`);
  const result = totalsDataSchema.safeParse({
    subtotal: data.subtotal,
    taxTotal: data.taxTotal,
    grandTotal: data.grandTotal,
  });

  if (!result.success) {
    const issuePath = result.error.issues[0]?.path.join('.') ?? 'totals';

    throw new EfaturaValidationError(
      field(issuePath),
      messages.validation.totalsNegative,
      'validation.totals_negative',
    );
  }

  return result.data;
}
