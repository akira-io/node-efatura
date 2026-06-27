import { z } from 'zod';
import { isRecord, optionalText } from '../../support/normalizers';
import { EfaturaValidationError } from '../errors';
import { type DiscountData, discountDataFrom } from './discount-data';
import { type QuantityData, quantityDataFrom } from './quantity-data';
import { type TaxData, taxDataFrom } from './tax-data';

export type LineTypeCode = 'N' | 'C' | 'D' | 'I';
export type StandardIdentificationKind = 'GTIN' | 'EAN' | 'UPC' | 'Pharmacode';

export interface StandardIdentificationData {
  type: StandardIdentificationKind;
  value: string;
}

export interface ExtraPropertyData {
  name: string;
  value: string;
}

export interface ItemData {
  description: string;
  packQuantity: QuantityData | null;
  name: string | null;
  brandName: string | null;
  modelName: string | null;
  emitterIdentification: string;
  standardIdentification: StandardIdentificationData | null;
  hazardousRiskIndicator: boolean | null;
  extraProperties: ExtraPropertyData[];
}

export interface LineItemData {
  lineTypeCode: LineTypeCode | null;
  id: string | null;
  lineReferenceId: string | null;
  orderLineReference: number | null;
  quantity: QuantityData;
  price: number | null;
  priceExtension: number | null;
  discount: DiscountData | null;
  netTotal: number | null;
  taxes: TaxData[];
  item: ItemData;
}

const nameSchema = z.preprocess(normalizeOptionalText, z.string().min(3).max(150).nullable());

export const itemDataSchema = z.object({
  description: z.preprocess(normalizeOptionalText, z.string().min(1).max(300)),
  packQuantity: z.custom<QuantityData>().nullable(),
  name: nameSchema,
  brandName: nameSchema,
  modelName: nameSchema,
  emitterIdentification: z.preprocess(normalizeOptionalText, z.string().min(1).max(50)),
  standardIdentification: z.custom<StandardIdentificationData>().nullable(),
  hazardousRiskIndicator: z.preprocess(optionalBoolean, z.boolean().nullable()),
  extraProperties: z.array(z.custom<ExtraPropertyData>()).default([]),
});

export const lineItemDataSchema = z
  .object({
    lineTypeCode: z.preprocess(normalizeLineType, z.enum(['N', 'C', 'D', 'I']).nullable()),
    id: z.preprocess(normalizeOptionalText, z.string().min(1).max(50).regex(/^\S+$/).nullable()),
    lineReferenceId: z.preprocess(
      normalizeOptionalText,
      z.string().min(1).max(50).regex(/^\S+$/).nullable(),
    ),
    orderLineReference: z.coerce.number().int().min(1).max(99999).nullable(),
    quantity: z.custom<QuantityData>(),
    price: z.coerce.number().finite().min(0).nullable(),
    priceExtension: z.coerce.number().finite().min(0).nullable(),
    discount: z.custom<DiscountData>().nullable(),
    netTotal: z.coerce.number().finite().min(0).nullable(),
    taxes: z.array(z.custom<TaxData>()).max(2).default([]),
    item: itemDataSchema,
  })
  .superRefine((line, context) => {
    if (line.lineTypeCode === 'C' && line.lineReferenceId === null) {
      context.addIssue({
        code: 'custom',
        path: ['lineReferenceId'],
        message: 'LineReferenceId is required for charge lines.',
      });
    }
  });

export function lineItemDataFrom(data: Record<string, unknown>, prefix = ''): LineItemData {
  const field = (name: string): string => (prefix === '' ? name : `${prefix}.${name}`);
  const taxes = Array.isArray(data.taxes) ? data.taxes.filter(isRecord) : [];
  const result = lineItemDataSchema.safeParse({
    lineTypeCode: data.lineTypeCode,
    id: data.id,
    lineReferenceId: data.lineReferenceId,
    orderLineReference: nullableNumber(data.orderLineReference),
    quantity: quantityDataFrom(data.quantity, undefined, field('quantity')),
    price: nullableNumber(data.price),
    priceExtension: nullableNumber(data.priceExtension),
    discount: discountDataFrom(data.discount, field('discount')),
    netTotal: nullableNumber(data.netTotal),
    taxes: taxes.map((tax, index) => taxDataFrom(tax, field(`taxes.${index}`))),
    item: itemDataFrom(data.item, field('item')),
  });

  if (!result.success) {
    const issuePath = result.error.issues[0]?.path.join('.') ?? 'line';
    const issueMessage = result.error.issues[0]?.message ?? 'Line item is invalid.';

    throw new EfaturaValidationError(field(issuePath), issueMessage, 'line_item.invalid');
  }

  return result.data;
}

export function itemDataFrom(value: unknown, prefix = 'item'): ItemData {
  if (!isRecord(value)) {
    throw new EfaturaValidationError(prefix, 'Item is required.', 'item.required');
  }

  const result = itemDataSchema.safeParse({
    description: value.description,
    packQuantity: isRecord(value.packQuantity)
      ? quantityDataFrom(
          value.packQuantity,
          value.packQuantity.unitCode,
          field(prefix, 'packQuantity'),
        )
      : null,
    name: value.name,
    brandName: value.brandName,
    modelName: value.modelName,
    emitterIdentification: value.emitterIdentification,
    standardIdentification: standardIdentificationFrom(value.standardIdentification),
    hazardousRiskIndicator: value.hazardousRiskIndicator,
    extraProperties: extraPropertiesFrom(value.extraProperties),
  });

  if (!result.success) {
    const issuePath = result.error.issues[0]?.path.join('.') ?? 'item';
    const issueMessage = result.error.issues[0]?.message ?? 'Item is invalid.';

    throw new EfaturaValidationError(field(prefix, issuePath), issueMessage, 'item.invalid');
  }

  return result.data;
}

function standardIdentificationFrom(value: unknown): StandardIdentificationData | null {
  if (!isRecord(value)) {
    return null;
  }

  for (const type of ['GTIN', 'EAN', 'UPC', 'Pharmacode'] as const) {
    const candidate = optionalText(value[type] ?? value[type.toLowerCase()]);

    if (candidate) {
      return { type, value: candidate };
    }
  }

  return null;
}

function extraPropertiesFrom(value: unknown): ExtraPropertyData[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord).map((property) => ({
    name: requiredPropertyText(property.name),
    value: requiredPropertyText(property.value),
  }));
}

function requiredPropertyText(value: unknown): string {
  const text = optionalText(value);

  if (!text) {
    throw new EfaturaValidationError(
      'extraProperties',
      'Extra property name and value are required.',
      'extra_properties.invalid',
    );
  }

  return text;
}

function nullableNumber(value: unknown): unknown {
  return value === undefined || value === null || value === '' ? null : value;
}

function normalizeOptionalText(value: unknown): string | null {
  return optionalText(value);
}

function normalizeLineType(value: unknown): LineTypeCode | null {
  const text = optionalText(value)?.toUpperCase();

  if (text === 'N' || text === 'C' || text === 'D' || text === 'I') {
    return text;
  }

  return null;
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
