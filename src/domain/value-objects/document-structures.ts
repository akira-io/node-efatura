import { z } from 'zod';
import { isRecord, optionalText, requiredText } from '../../support/normalizers';
import { EfaturaValidationError } from '../errors';
import { type AddressData, addressDataFrom } from './address-data';
import { type TaxData, taxDataFrom } from './tax-data';

export type {
  PayeeFinancialAccountData,
  PaymentData,
  PaymentsData,
} from './payment-structures';
export {
  payeeFinancialAccountDataSchema,
  paymentDataSchema,
  paymentsDataFrom,
  paymentsDataSchema,
} from './payment-structures';

export type {
  DurationData,
  TransportLocationData,
  TransportRouteData,
} from './transport-structures';
export {
  durationDataSchema,
  transportLocationDataSchema,
  transportRouteDataFrom,
  transportRouteDataSchema,
} from './transport-structures';

export interface SelfBillingData {
  authorizationId: string;
  authorizationCode: string;
}

export interface DatePeriodData {
  startDate: string;
  endDate: string;
}

export interface FiscalDocumentData {
  value: string;
  isOldDocument: boolean | null;
}

export interface ReferenceData {
  fiscalDocument: FiscalDocumentData | null;
  innerDocumentNumber: string | null;
  paymentAmount: number | null;
  tax: TaxData | null;
}

export interface DeliveryData {
  deliveryDate: string;
  address: AddressData;
}

export interface RentReceiptData {
  assetId: string;
  rentPurposeTypeCode: string;
  contractTypeCode: string;
  rentTypeCode: string;
  referencePeriod: string;
  address: AddressData;
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const selfBillingDataSchema = z.object({
  authorizationId: z.uuid(),
  authorizationCode: z.string().regex(/^\d{4,10}$/),
});

export const datePeriodDataSchema = z.object({
  startDate: dateSchema,
  endDate: dateSchema,
});

export const fiscalDocumentDataSchema = z.object({
  value: z.string().min(1),
  isOldDocument: z.preprocess(optionalBoolean, z.boolean().nullable()),
});

export const referenceDataSchema = z
  .object({
    fiscalDocument: fiscalDocumentDataSchema.nullable(),
    innerDocumentNumber: z.preprocess(normalizeOptionalText, z.string().max(50).nullable()),
    paymentAmount: z.coerce.number().finite().gt(0).nullable(),
    tax: z.custom<TaxData>().nullable(),
  })
  .superRefine((reference, context) => {
    if (!reference.fiscalDocument && reference.paymentAmount === null && reference.tax === null) {
      context.addIssue({
        code: 'custom',
        path: ['fiscalDocument'],
        message: 'Reference requires FiscalDocument, PaymentAmount, or Tax.',
      });
    }
  });

export const deliveryDataSchema = z.object({
  deliveryDate: dateSchema,
  address: z.custom<AddressData>(),
});

export const rentReceiptDataSchema = z.object({
  assetId: z.string().min(1).max(50).regex(/^\S+$/),
  rentPurposeTypeCode: z.enum(['1', '2', '3']),
  contractTypeCode: z.enum(['1', '2', '3', '4']),
  rentTypeCode: z.enum(['1', '2', '3']),
  referencePeriod: z.string().regex(/^2\d{3}-(0[1-9]|1[0-2])$/),
  address: z.custom<AddressData>(),
});

export function selfBillingDataFrom(
  value: unknown,
  prefix = 'selfBilling',
): SelfBillingData | null {
  return parseNullable(value, selfBillingDataSchema, prefix, 'SelfBilling is invalid.');
}

export function datePeriodDataFrom(value: unknown, prefix = 'datePeriod'): DatePeriodData | null {
  return parseNullable(value, datePeriodDataSchema, prefix, 'Date period is invalid.');
}

export function referencesDataFrom(value: unknown, prefix = 'references'): ReferenceData[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord).map((reference, index) => {
    const tax = isRecord(reference.tax)
      ? taxDataFrom(reference.tax, field(prefix, `${index}.tax`))
      : null;

    return parseRequired(
      {
        fiscalDocument: fiscalDocumentFrom(reference.fiscalDocument),
        innerDocumentNumber: reference.innerDocumentNumber,
        paymentAmount: nullableNumber(reference.paymentAmount),
        tax,
      },
      referenceDataSchema,
      field(prefix, String(index)),
      'Reference is invalid.',
    );
  });
}

export function deliveryDataFrom(value: unknown, prefix = 'delivery'): DeliveryData | null {
  if (!isRecord(value)) {
    return null;
  }

  return parseRequired(
    {
      deliveryDate: value.deliveryDate,
      address: addressDataFrom(value.address, field(prefix, 'address')),
    },
    deliveryDataSchema,
    prefix,
    'Delivery is invalid.',
  );
}

export function rentReceiptDataFrom(
  value: unknown,
  prefix = 'rentReceipt',
): RentReceiptData | null {
  if (!isRecord(value)) {
    return null;
  }

  return parseRequired(
    {
      assetId: value.assetId,
      rentPurposeTypeCode: String(value.rentPurposeTypeCode ?? ''),
      contractTypeCode: String(value.contractTypeCode ?? ''),
      rentTypeCode: String(value.rentTypeCode ?? ''),
      referencePeriod: value.referencePeriod,
      address: addressDataFrom(value.address, field(prefix, 'address')),
    },
    rentReceiptDataSchema,
    prefix,
    'RentReceipt is invalid.',
  );
}

function fiscalDocumentFrom(value: unknown): FiscalDocumentData | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    value: requiredText(
      value.value,
      'fiscalDocument.value',
      'FiscalDocument is required.',
      'reference.fiscal_document_required',
    ),
    isOldDocument: optionalBoolean(value.isOldDocument),
  };
}

function parseNullable<T>(
  value: unknown,
  schema: z.ZodType<T>,
  prefix: string,
  message: string,
): T | null {
  return isRecord(value) ? parseRequired(value, schema, prefix, message) : null;
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

function nullableNumber(value: unknown): unknown {
  return value === undefined || value === null || value === '' ? null : value;
}

function normalizeOptionalText(value: unknown): string | null {
  return optionalText(value);
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
