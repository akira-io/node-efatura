import { z } from 'zod';
import { isRecord, optionalText } from '../../support/normalizers';
import { EfaturaValidationError } from '../errors';

export interface ContactsData {
  telephone: string | null;
  mobilephone: string | null;
  telefax: string | null;
  email: string | null;
  website: string | null;
}

const phoneSchema = z.preprocess(
  normalizeOptionalText,
  z.string().regex(/^\d+$/).max(20).nullable(),
);

export const contactsDataSchema = z.object({
  telephone: phoneSchema,
  mobilephone: phoneSchema,
  telefax: phoneSchema,
  email: z.preprocess(normalizeOptionalText, z.email().max(256).nullable()),
  website: z.preprocess(normalizeOptionalText, z.string().max(256).nullable()),
});

export function contactsDataFrom(value: unknown, prefix = 'contacts'): ContactsData | null {
  const data = normalizeContactsInput(value);

  if (data === null) {
    return null;
  }

  const result = contactsDataSchema.safeParse(data);

  if (!result.success) {
    const issuePath = result.error.issues[0]?.path.join('.') ?? 'contacts';

    throw new EfaturaValidationError(
      field(prefix, issuePath),
      'Contacts are invalid.',
      'contacts.invalid',
    );
  }

  return result.data;
}

function normalizeContactsInput(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    telephone: value.telephone,
    mobilephone: value.mobilephone,
    telefax: value.telefax,
    email: value.email,
    website: value.website,
  };
}

function normalizeOptionalText(value: unknown): string | null {
  return optionalText(value);
}

function field(prefix: string, name: string): string {
  return prefix === '' ? name : `${prefix}.${name}`;
}
