import { EfaturaValidationError } from '../../domain/errors';
import type { PartyData } from '../../domain/value-objects/party-data';

export function escapeXml(value: string | number | boolean): string {
  return xmlText(value)
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

function xmlText(value: string | number | boolean): string {
  if (typeof value !== 'number') {
    return String(value);
  }

  return formatXmlNumber(value);
}

function formatXmlNumber(value: number): string {
  const roundedValue = Math.round(value * 100000) / 100000;
  const formattedValue = roundedValue.toLocaleString('en-US', {
    maximumFractionDigits: 5,
    useGrouping: false,
  });

  return formattedValue === '-0' ? '0' : formattedValue;
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
