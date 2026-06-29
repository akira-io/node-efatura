import { z } from 'zod';
import {
  type DocumentType,
  documentTypeFromCode,
  documentTypeFromValue,
  isDocumentType,
} from '../enums/document-type';
import { EventType, eventTypeFromValue } from '../enums/event-type';
import { EfaturaValidationError } from '../errors';
import { validateEventId } from '../iud/event-id';
import { validateIud } from '../iud/iud';
import { isValidEventDateTime } from './event-date-time';

export interface EventDocumentRangeData {
  year: string | null;
  ledCode: string;
  serie: string;
  documentType: DocumentType;
  documentNumberStart: number;
  documentNumberEnd: number;
}

export interface EventData {
  id: string | null;
  type: EventType;
  issueDateTime: string;
  issueReasonDescription: string;
  iuds: string[];
  range: EventDocumentRangeData | null;
}

const issueDateTimeSchema = z
  .string()
  .refine(isValidEventDateTime, 'IssueDateTime must be a valid ISO date-time.');

const documentNumberSchema = z.coerce.number().int().min(1).max(999999999);

export const eventDocumentRangeDataSchema = z
  .object({
    year: z
      .preprocess(
        (value) => optionalText(value),
        z
          .string()
          .regex(/^20[2-9]\d$/)
          .nullable(),
      )
      .default(null),
    ledCode: z.string().min(1).max(5).regex(/^\d+$/),
    serie: z
      .string()
      .min(1)
      .max(20)
      .regex(/^[A-Za-z0-9]+([_-][A-Za-z0-9]+)*$/),
    documentType: z.custom<DocumentType>(
      (value) => typeof value === 'string' && isDocumentType(value),
    ),
    documentNumberStart: documentNumberSchema,
    documentNumberEnd: documentNumberSchema,
  })
  .superRefine((range, context) => {
    if (range.documentNumberEnd < range.documentNumberStart) {
      context.addIssue({
        code: 'custom',
        path: ['documentNumberEnd'],
        message: 'DocumentNumberEnd must be greater than or equal to DocumentNumberStart.',
      });
    }
  });

export const eventDataSchema = z
  .object({
    id: z.preprocess((value) => optionalText(value), z.string().nullable()),
    type: z.custom<EventType>(),
    issueDateTime: issueDateTimeSchema,
    issueReasonDescription: z.string().min(1).max(300),
    iuds: z.array(z.string().refine(validateIud, 'IUD is invalid.')).default([]),
    range: eventDocumentRangeDataSchema.nullable(),
  })
  .superRefine((event, context) => {
    if (event.id !== null && !validateEventId(event.id)) {
      context.addIssue({ code: 'custom', path: ['id'], message: 'Event Id is invalid.' });
    }

    if (event.iuds.length > 0 && event.range !== null) {
      context.addIssue({
        code: 'custom',
        path: ['range'],
        message: 'Event must target either IUDs or a document number range.',
      });
    }

    if (event.type === EventType.FiscalDocumentCancellation && event.iuds.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['iuds'],
        message: 'FDC events require at least one IUD.',
      });
    }

    if (event.type === EventType.UnusedDocumentNumber && event.range === null) {
      context.addIssue({
        code: 'custom',
        path: ['range'],
        message: 'UDN events require a document number range.',
      });
    }
  });

export function eventDataFrom(value: Record<string, unknown>, prefix = 'event'): EventData {
  const type = eventTypeFromValue(value.type ?? value.eventTypeCode);

  if (type === null) {
    throw new EfaturaValidationError(
      field(prefix, 'type'),
      'EventTypeCode must be FDC or UDN.',
      'event.type_invalid',
    );
  }

  return parseRequired(
    {
      id: value.id,
      type,
      issueDateTime: value.issueDateTime,
      issueReasonDescription: value.issueReasonDescription,
      iuds: eventIudsFrom(value.iuds ?? value.iud),
      range: eventRangeFrom(value.range),
    },
    eventDataSchema,
    prefix,
    'Event is invalid.',
  );
}

function eventRangeFrom(value: unknown): EventDocumentRangeData | null {
  if (!isRecord(value)) {
    return null;
  }

  const documentType =
    documentTypeFromValue(value.documentType) ?? documentTypeFromCode(value.documentTypeCode);

  if (!documentType) {
    throw new EfaturaValidationError(
      'event.range.documentType',
      'Event range document type is invalid.',
      'event.range.document_type_invalid',
    );
  }

  return {
    year: optionalText(value.year),
    ledCode: String(value.ledCode ?? ''),
    serie: String(value.serie ?? ''),
    documentType,
    documentNumberStart: Number(value.documentNumberStart),
    documentNumberEnd: Number(value.documentNumberEnd),
  };
}

function eventIudsFrom(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }

  return typeof value === 'string' ? [value] : [];
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

    throw new EfaturaValidationError(field(prefix, issuePath), message, 'event.invalid');
  }

  return result.data;
}

function optionalText(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim() === '' ? null : value.trim();
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function field(prefix: string, name: string): string {
  return prefix === '' ? name : `${prefix}.${name}`;
}
