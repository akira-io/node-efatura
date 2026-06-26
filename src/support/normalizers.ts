import { EfaturaValidationError } from '../domain/errors';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function optionalText(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim() === '' ? null : value.trim();
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return null;
}

export function requiredText(value: unknown, field: string, message: string, code: string): string {
  const normalized = optionalText(value);

  if (normalized === null) {
    throw new EfaturaValidationError(field, message, code);
  }

  return normalized;
}

export function requiredNumber(
  value: unknown,
  field: string,
  message: string,
  code: string,
): number {
  const normalized = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(normalized)) {
    throw new EfaturaValidationError(field, message, code);
  }

  return normalized;
}
