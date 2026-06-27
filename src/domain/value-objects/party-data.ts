import { z } from 'zod';
import { optionalText } from '../../support/normalizers';
import { EfaturaValidationError } from '../errors';
import { type AddressData, addressDataFrom } from './address-data';
import { type ContactsData, contactsDataFrom } from './contacts-data';
import { type TaxIdData, taxIdDataFrom, taxIdDataSchema } from './tax-id';

export interface PartyData {
  reference: 'EP' | 'RP' | null;
  taxId: TaxIdData | null;
  name: string | null;
  address: AddressData | null;
  contacts: ContactsData | null;
}

export const partyDataSchema = z
  .object({
    reference: z.preprocess(normalizeReference, z.enum(['EP', 'RP']).nullable()),
    taxId: taxIdDataSchema.nullable(),
    name: z.preprocess(normalizeOptionalText, z.string().min(3).max(150).nullable()),
    address: z.custom<AddressData>().nullable(),
    contacts: z.custom<ContactsData>().nullable(),
  })
  .superRefine((party, context) => {
    if (party.reference) {
      return;
    }

    if (!party.taxId) {
      context.addIssue({ code: 'custom', path: ['taxId'], message: 'Party TaxId is required.' });
    }

    if (!party.name) {
      context.addIssue({ code: 'custom', path: ['name'], message: 'Party name is required.' });
    }
  });

export function partyDataFrom(data: Record<string, unknown>, prefix = ''): PartyData {
  const field = (name: string): string => (prefix === '' ? name : `${prefix}.${name}`);
  const taxId = taxIdDataFrom(data.taxId, field('taxId'));
  const result = partyDataSchema.safeParse({
    reference: data.reference,
    taxId,
    name: data.name,
    address: addressDataFrom(data.address, field('address')),
    contacts: contactsDataFrom(data.contacts, field('contacts')),
  });

  if (!result.success) {
    const issuePath = result.error.issues[0]?.path.join('.') ?? 'party';
    const issueMessage = result.error.issues[0]?.message ?? 'Party is invalid.';

    throw new EfaturaValidationError(field(issuePath), issueMessage, 'party.invalid');
  }

  return result.data;
}

function normalizeOptionalText(value: unknown): string | null {
  return optionalText(value);
}

function normalizeReference(value: unknown): 'EP' | 'RP' | null {
  const text = optionalText(value)?.toUpperCase();

  if (text === 'EP' || text === 'RP') {
    return text;
  }

  return null;
}
