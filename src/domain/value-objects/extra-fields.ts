import { z } from 'zod';
import { isRecord, optionalText } from '../../support/normalizers';
import { EfaturaValidationError } from '../errors';

export type ExtraFieldScalar = string | number | boolean;

export interface ExtraFieldData {
  name: string;
  value: ExtraFieldScalar | null;
  attributes: Record<string, ExtraFieldScalar>;
  children: ExtraFieldData[];
}

const xmlNameSchema = z.string().regex(/^[A-Za-z_][A-Za-z0-9_.-]*$/);

export const extraFieldDataSchema: z.ZodType<ExtraFieldData> = z.lazy(() =>
  z
    .object({
      name: xmlNameSchema,
      value: z.union([z.string(), z.number(), z.boolean()]).nullable(),
      attributes: z.record(xmlNameSchema, z.union([z.string(), z.number(), z.boolean()])),
      children: z.array(extraFieldDataSchema),
    })
    .superRefine((extraField, context) => {
      if (extraField.value !== null && extraField.children.length > 0) {
        context.addIssue({
          code: 'custom',
          path: ['children'],
          message: 'ExtraField must contain either value or children.',
        });
      }
    }),
);

export const extraFieldsDataSchema = z.array(extraFieldDataSchema);

export function extraFieldsDataFrom(value: unknown, prefix = 'extraFields'): ExtraFieldData[] {
  if (Array.isArray(value)) {
    return value.map((extraField, index) => extraFieldDataFrom(extraField, field(prefix, index)));
  }

  if (isRecord(value)) {
    return Object.entries(value).map(([name, fieldValue], index) =>
      extraFieldDataFrom({ name, value: fieldValue }, field(prefix, index)),
    );
  }

  return [];
}

function extraFieldDataFrom(value: unknown, prefix: string): ExtraFieldData {
  if (!isRecord(value)) {
    throw new EfaturaValidationError(
      prefix,
      'ExtraField must be an object.',
      'extra_field.invalid',
    );
  }

  const children = Array.isArray(value.children)
    ? value.children.map((child, index) =>
        extraFieldDataFrom(child, field(prefix, `children.${index}`)),
      )
    : childrenFromRecordValue(value.value, prefix);
  const normalizedValue = children.length > 0 ? null : scalarFrom(value.value);
  const result = extraFieldDataSchema.safeParse({
    name: requiredText(value.name, field(prefix, 'name')),
    value: normalizedValue,
    attributes: attributesFrom(value.attributes),
    children,
  });

  if (!result.success) {
    const issuePath = result.error.issues[0]?.path.join('.') ?? prefix;

    throw new EfaturaValidationError(
      field(prefix, issuePath),
      'ExtraField is invalid.',
      'extra_field.invalid',
    );
  }

  return result.data;
}

function childrenFromRecordValue(value: unknown, prefix: string): ExtraFieldData[] {
  if (!isRecord(value)) {
    return [];
  }

  return Object.entries(value).map(([name, childValue], index) =>
    extraFieldDataFrom({ name, value: childValue }, field(prefix, `children.${index}`)),
  );
}

function attributesFrom(value: unknown): Record<string, ExtraFieldScalar> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([name, attributeValue]) => [name, scalarFrom(attributeValue)] as const)
      .filter((entry): entry is readonly [string, ExtraFieldScalar] => entry[1] !== null),
  );
}

function scalarFrom(value: unknown): ExtraFieldScalar | null {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  return null;
}

function requiredText(value: unknown, path: string): string {
  const text = optionalText(value);

  if (!text) {
    throw new EfaturaValidationError(
      path,
      'ExtraField name is required.',
      'extra_field.name_required',
    );
  }

  return text;
}

function field(prefix: string, name: string | number): string {
  return prefix === '' ? String(name) : `${prefix}.${name}`;
}
