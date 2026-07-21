import { z } from 'zod';
import { messages } from '../../support/messages';
import { isRecord } from '../../support/normalizers';
import { SCHEMA_CURRENCY_CODES } from '../currency/schema-currency-codes';
import { EfaturaValidationError } from '../errors';
import { type DiscountData, discountDataFrom } from './discount-data';

export interface PayableAlternativeAmountData {
  value: number;
  currencyCode: string;
  exchangeRate: number;
}

export interface TotalsData {
  priceExtensionTotalAmount: number;
  chargeTotalAmount: number | null;
  discountTotalAmount: number | null;
  netTotalAmount: number;
  discount: DiscountData | null;
  taxTotalAmount: number;
  withholdingTaxTotalAmount: number | null;
  payableRoundingAmount: number | null;
  payableAmount: number;
  payableAlternativeAmounts: PayableAlternativeAmountData[];
}

export const payableAlternativeAmountSchema = z.object({
  value: z.coerce.number().finite().min(0),
  currencyCode: z.preprocess(
    (value) => String(value ?? '').toUpperCase(),
    z.enum(SCHEMA_CURRENCY_CODES),
  ),
  exchangeRate: z.coerce.number().finite().gt(0),
});

export const totalsDataSchema = z.object({
  priceExtensionTotalAmount: z.coerce.number().finite().min(0),
  chargeTotalAmount: z.coerce.number().finite().min(0).nullable(),
  discountTotalAmount: z.coerce.number().finite().min(0).nullable(),
  netTotalAmount: z.coerce.number().finite().min(0),
  discount: z.custom<DiscountData>().nullable(),
  taxTotalAmount: z.coerce.number().finite().min(0),
  withholdingTaxTotalAmount: z.coerce.number().finite().min(0).nullable(),
  payableRoundingAmount: z.coerce.number().finite().nullable(),
  payableAmount: z.coerce.number().finite().min(0),
  payableAlternativeAmounts: z.array(payableAlternativeAmountSchema).default([]),
});

export function totalsDataFrom(data: Record<string, unknown>, prefix = ''): TotalsData {
  const field = (name: string): string => (prefix === '' ? name : `${prefix}.${name}`);
  const result = totalsDataSchema.safeParse({
    priceExtensionTotalAmount: data.priceExtensionTotalAmount,
    chargeTotalAmount: nullableNumber(data.chargeTotalAmount),
    discountTotalAmount: nullableNumber(data.discountTotalAmount),
    netTotalAmount: data.netTotalAmount,
    discount: discountDataFrom(data.discount, field('discount')),
    taxTotalAmount: data.taxTotalAmount,
    withholdingTaxTotalAmount: nullableNumber(data.withholdingTaxTotalAmount),
    payableRoundingAmount: nullableNumber(data.payableRoundingAmount),
    payableAmount: data.payableAmount,
    payableAlternativeAmounts: alternativeAmountsFrom(data.payableAlternativeAmounts),
  });

  if (!result.success) {
    const issuePath = result.error.issues[0]?.path.join('.') ?? 'totals';

    if (isPayableAlternativeCurrencyIssue(issuePath)) {
      throw new EfaturaValidationError(
        field(issuePath),
        messages.validation.payableAlternativeCurrencyUnsupported,
        'validation.payable_alternative_currency_unsupported',
      );
    }

    throw new EfaturaValidationError(
      field(issuePath),
      messages.validation.totalsNegative,
      'validation.totals_negative',
    );
  }

  return result.data;
}

function isPayableAlternativeCurrencyIssue(issuePath: string): boolean {
  return /^payableAlternativeAmounts\.\d+\.currencyCode$/.test(issuePath);
}

function alternativeAmountsFrom(value: unknown): PayableAlternativeAmountData[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord).map((item) => ({
    value: item.value,
    currencyCode: item.currencyCode,
    exchangeRate: item.exchangeRate,
  })) as PayableAlternativeAmountData[];
}

function nullableNumber(value: unknown): unknown {
  return value === undefined || value === null || value === '' ? null : value;
}
