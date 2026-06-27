import {
  type DocumentType,
  documentTypeFromCode,
  documentTypeFromValue,
} from '../domain/enums/document-type';
import { EfaturaValidationError } from '../domain/errors';
import type { BuildIudInput } from '../domain/iud/iud';
import type { InvoiceData } from '../domain/value-objects/invoice-data';

export function isInvoiceData(value: Record<string, unknown> | InvoiceData): value is InvoiceData {
  return (
    typeof value.type === 'string' &&
    typeof value.issueDate === 'string' &&
    typeof value.emitter === 'object' &&
    Array.isArray(value.lines) &&
    'issueTime' in value &&
    'contingency' in value &&
    'references' in value &&
    'payments' in value &&
    'extraFields' in value
  );
}

export function requireDocumentNumber(value: number | string | undefined): number | string {
  if (value === undefined || value === '') {
    throw new Error('documentNumber is required when no IUD is provided.');
  }

  return value;
}

export function normalizeIssueDate(value: string | Date): string {
  return typeof value === 'string' ? value : value.toISOString().slice(0, 10);
}

export function normalizeDocumentTypeForSequence(
  value: BuildIudInput['documentType'],
): DocumentType {
  const documentType = documentTypeFromValue(value) ?? documentTypeFromCode(value);

  if (!documentType) {
    throw new EfaturaValidationError(
      'documentType',
      'Document type is invalid.',
      'document_type.invalid',
    );
  }

  return documentType;
}
