import { z } from 'zod';
import { messages } from '../../support/messages';
import { optionalText } from '../../support/normalizers';
import { EfaturaValidationError } from '../errors';

export interface PartyData {
  nif: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
}

export const partyDataSchema = z.object({
  nif: z.preprocess(normalizeOptionalText, z.string().min(1)),
  name: z.preprocess(normalizeOptionalText, z.string().min(1)),
  address: z.preprocess(normalizeOptionalText, z.string().nullable()),
  city: z.preprocess(normalizeOptionalText, z.string().nullable()),
  country: z.preprocess(normalizeOptionalText, z.string().nullable()),
  email: z.preprocess(normalizeOptionalText, z.string().nullable()),
  phone: z.preprocess(normalizeOptionalText, z.string().nullable()),
});

export function partyDataFrom(data: Record<string, unknown>, prefix = ''): PartyData {
  const field = (name: string): string => (prefix === '' ? name : `${prefix}.${name}`);
  const result = partyDataSchema.safeParse({
    nif: data.nif,
    name: data.name,
    address: data.address,
    city: data.city,
    country: data.country,
    email: data.email,
    phone: data.phone,
  });

  if (!result.success) {
    const issuePath = result.error.issues[0]?.path.join('.');

    if (issuePath === 'nif') {
      throw new EfaturaValidationError(
        field('nif'),
        messages.validation.partyNifRequired,
        'validation.party_nif_required',
      );
    }

    if (issuePath === 'name') {
      throw new EfaturaValidationError(
        field('name'),
        messages.validation.partyNameRequired,
        'validation.party_name_required',
      );
    }

    throw new EfaturaValidationError(
      field(issuePath ?? 'party'),
      'Party is invalid.',
      'party.invalid',
    );
  }

  return result.data;
}

function normalizeOptionalText(value: unknown): string | null {
  return optionalText(value);
}
