import { z } from 'zod';
import { isRecord, optionalText } from '../../support/normalizers';
import { EfaturaValidationError } from '../errors';
import { type AddressData, addressDataFrom } from './address-data';

export interface DurationData {
  startDate: string;
  startTime: string;
  endDate: string | null;
  endTime: string | null;
}

export interface TransportLocationData {
  address: AddressData;
  duration: DurationData;
  transportModeCode: string;
  vehicleRegistrationCode: string | null;
}

export interface TransportRouteData {
  locations: TransportLocationData[];
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeSchema = z.string().regex(/^\d{2}:\d{2}:\d{2}$/);

export const durationDataSchema = z.object({
  startDate: dateSchema,
  startTime: timeSchema,
  endDate: z.preprocess(normalizeOptionalText, dateSchema.nullable()),
  endTime: z.preprocess(normalizeOptionalText, timeSchema.nullable()),
});

export const transportLocationDataSchema = z.object({
  address: z.custom<AddressData>(),
  duration: durationDataSchema,
  transportModeCode: z.enum(['0', '1', '2', '3', '4', '5', '6', '7', '8']),
  vehicleRegistrationCode: z.preprocess(normalizeOptionalText, z.string().max(50).nullable()),
});

export const transportRouteDataSchema = z.object({
  locations: z.array(transportLocationDataSchema).min(2),
});

export function transportRouteDataFrom(
  value: unknown,
  prefix = 'transportRoute',
): TransportRouteData | null {
  if (!isRecord(value) || !Array.isArray(value.locations)) {
    return null;
  }

  return parseRequired(
    {
      locations: value.locations.filter(isRecord).map((location, index) => ({
        address: addressDataFrom(location.address, field(prefix, `${index}.address`)),
        duration: location.duration,
        transportModeCode: String(location.transportModeCode ?? ''),
        vehicleRegistrationCode: location.vehicleRegistrationCode,
      })),
    },
    transportRouteDataSchema,
    prefix,
    'TransportRoute is invalid.',
  );
}

function parseRequired<T>(
  value: unknown,
  schema: z.ZodType<T>,
  prefix: string,
  message: string,
): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    const issuePath = result.error.issues[0]?.path.join('.') ?? prefix;

    throw new EfaturaValidationError(
      field(prefix, issuePath),
      message,
      'document_structure.invalid',
    );
  }

  return result.data;
}

function normalizeOptionalText(value: unknown): string | null {
  return optionalText(value);
}

function field(prefix: string, name: string): string {
  return prefix === '' ? name : `${prefix}.${name}`;
}
