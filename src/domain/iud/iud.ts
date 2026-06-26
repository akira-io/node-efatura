import { randomInt } from 'node:crypto';
import {
  type DocumentType,
  documentTypeFromCode,
  documentTypeFromValue,
  documentTypeIudCode,
} from '../enums/document-type';
import { EfaturaValidationError } from '../errors';
import { calculateLuhnCheckDigit, validateLuhn } from './luhn';

export interface BuildIudInput {
  country?: string;
  repositoryCode: number | string;
  issueDate: Date | string;
  emitterNif: number | string;
  led: number | string;
  documentType: DocumentType | number | string;
  documentNumber: number | string;
  randomCode?: number | string;
}

export interface ParsedIud {
  country: string;
  repositoryCode: number;
  issueDate: string;
  emitterNif: string;
  led: string;
  documentTypeCode: string;
  documentNumber: string;
  randomCode: string;
  checkDigit: string;
}

export function buildIud(input: BuildIudInput): string {
  const country = normalizeCountry(input.country ?? 'CV');
  const repositoryCode = normalizeFixedDigits(input.repositoryCode, 1, 'repositoryCode');
  const date = normalizeIssueDate(input.issueDate);
  const emitterNif = normalizeFixedDigits(input.emitterNif, 9, 'emitterNif');
  const led = normalizeFixedDigits(input.led, 5, 'led');
  const documentType = normalizeDocumentType(input.documentType);
  const documentTypeCode = documentTypeIudCode(documentType);
  const documentNumber = normalizeFixedDigits(input.documentNumber, 9, 'documentNumber');
  const randomCode = normalizeFixedDigits(
    input.randomCode ?? generateIudRandomCode(),
    10,
    'randomCode',
  );
  const numericPayload =
    repositoryCode + date + emitterNif + led + documentTypeCode + documentNumber + randomCode;
  const checkDigit = calculateLuhnCheckDigit(numericPayload);

  return `${country}${numericPayload}${checkDigit}`;
}

export function validateIud(iud: string): boolean {
  if (!/^CV\d{43}$/.test(iud)) {
    return false;
  }

  return validateLuhn(iud.slice(2));
}

export function parseIud(iud: string): ParsedIud {
  if (!validateIud(iud)) {
    throw new EfaturaValidationError('iud', 'IUD is invalid.', 'iud.invalid');
  }

  return {
    country: iud.slice(0, 2),
    repositoryCode: Number(iud.slice(2, 3)),
    issueDate: `20${iud.slice(3, 5)}-${iud.slice(5, 7)}-${iud.slice(7, 9)}`,
    emitterNif: iud.slice(9, 18),
    led: iud.slice(18, 23),
    documentTypeCode: iud.slice(23, 25),
    documentNumber: iud.slice(25, 34),
    randomCode: iud.slice(34, 44),
    checkDigit: iud.slice(44, 45),
  };
}

export function generateIudRandomCode(): string {
  return String(randomInt(0, 10_000_000_000)).padStart(10, '0');
}

function normalizeCountry(value: string): string {
  const country = value.trim().toUpperCase();

  if (country !== 'CV') {
    throw new EfaturaValidationError('country', 'IUD country must be CV.', 'iud.country');
  }

  return country;
}

function normalizeFixedDigits(value: number | string, length: number, field: string): string {
  const digits = String(value).trim();

  if (!/^\d+$/.test(digits)) {
    throw new EfaturaValidationError(field, `${field} must contain only digits.`, `iud.${field}`);
  }

  if (digits.length > length) {
    throw new EfaturaValidationError(
      field,
      `${field} must not exceed ${length} digits.`,
      `iud.${field}_length`,
    );
  }

  return digits.padStart(length, '0');
}

function normalizeIssueDate(value: Date | string): string {
  if (value instanceof Date) {
    return [
      String(value.getFullYear()).slice(-2),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0'),
    ].join('');
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());

  if (!match) {
    throw new EfaturaValidationError(
      'issueDate',
      'Issue date must use YYYY-MM-DD format.',
      'iud.issue_date',
    );
  }

  const year = match[1];
  const month = match[2];
  const day = match[3];

  if (year === undefined || month === undefined || day === undefined) {
    throw new EfaturaValidationError(
      'issueDate',
      'Issue date must use YYYY-MM-DD format.',
      'iud.issue_date',
    );
  }

  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day)
  ) {
    throw new EfaturaValidationError('issueDate', 'Issue date is invalid.', 'iud.issue_date');
  }

  return `${year.slice(-2)}${month}${day}`;
}

function normalizeDocumentType(value: BuildIudInput['documentType']): DocumentType {
  const type = documentTypeFromValue(value) ?? documentTypeFromCode(value);

  if (type === null) {
    throw new EfaturaValidationError(
      'documentType',
      'Document type is invalid.',
      'iud.document_type',
    );
  }

  return type;
}
