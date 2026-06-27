import { EfaturaValidationError } from '../../domain/errors';
import type { PartyData } from '../../domain/value-objects/party-data';

export function escapeXml(value: string | number | boolean): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function element(name: string, value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  return `<${name}>${escapeXml(value)}</${name}>`;
}

export function escapeAttribute(value: string | number | boolean): string {
  return escapeXml(value);
}

export function requiredValue<T>(value: T | null | undefined, field: string): T {
  if (value === null || value === undefined || value === '') {
    throw new EfaturaValidationError(field, `${field} is required.`, `${field}.required`);
  }

  return value;
}

export function requiredParty(value: PartyData | null, field: string): PartyData {
  return requiredValue(value, field);
}
