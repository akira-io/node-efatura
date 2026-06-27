import { z } from 'zod';
import { isRecord, optionalText } from '../../support/normalizers';
import { EfaturaValidationError } from '../errors';

export interface AddressData {
  countryCode: string;
  state: string | null;
  city: string | null;
  region: string | null;
  street: string | null;
  streetDetail: string | null;
  buildingName: string | null;
  buildingNumber: string | null;
  buildingFloor: string | null;
  postalCode: string | null;
  addressDetail: string;
  addressCode: string | null;
}

const limitedTextSchema = z.preprocess(normalizeOptionalText, z.string().max(100).nullable());

export const addressDataSchema = z.object({
  countryCode: z.preprocess(normalizeCountry, z.string().length(2)),
  state: limitedTextSchema,
  city: limitedTextSchema,
  region: limitedTextSchema,
  street: limitedTextSchema,
  streetDetail: limitedTextSchema,
  buildingName: limitedTextSchema,
  buildingNumber: limitedTextSchema,
  buildingFloor: limitedTextSchema,
  postalCode: limitedTextSchema,
  addressDetail: z.preprocess(normalizeOptionalText, z.string().min(1).max(100)),
  addressCode: z.preprocess(normalizeOptionalText, z.string().max(20).nullable()),
});

export function addressDataFrom(value: unknown, prefix = 'address'): AddressData | null {
  const data = normalizeAddressInput(value);

  if (data === null) {
    return null;
  }

  const result = addressDataSchema.safeParse(data);

  if (!result.success) {
    const issuePath = result.error.issues[0]?.path.join('.') ?? 'address';

    throw new EfaturaValidationError(
      field(prefix, issuePath),
      'Address is invalid.',
      'address.invalid',
    );
  }

  return result.data;
}

function normalizeAddressInput(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string' || typeof value === 'number') {
    const addressDetail = optionalText(value);

    return addressDetail ? { countryCode: 'CV', addressDetail } : null;
  }

  if (!isRecord(value)) {
    return null;
  }

  return {
    countryCode: value.countryCode,
    state: value.state,
    city: value.city,
    region: value.region,
    street: value.street,
    streetDetail: value.streetDetail,
    buildingName: value.buildingName,
    buildingNumber: value.buildingNumber,
    buildingFloor: value.buildingFloor,
    postalCode: value.postalCode,
    addressDetail: value.addressDetail,
    addressCode: value.addressCode,
  };
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
