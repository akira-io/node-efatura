export const TaxTypeCode = {
  NotApplicable: 'NA',
  IVA: 'IVA',
  StampTax: 'IS',
  IncomeTax: 'IR',
} as const;

export type TaxTypeCode = (typeof TaxTypeCode)[keyof typeof TaxTypeCode];

export const TAX_TYPE_CODES = Object.values(TaxTypeCode) as readonly TaxTypeCode[];

export function taxTypeCodeFromValue(value: unknown): TaxTypeCode | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.toUpperCase();

  return isTaxTypeCode(normalized) ? normalized : null;
}

export function isTaxTypeCode(value: string): value is TaxTypeCode {
  return (TAX_TYPE_CODES as readonly string[]).includes(value);
}
