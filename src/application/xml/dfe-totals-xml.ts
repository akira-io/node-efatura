import type {
  PayableAlternativeAmountData,
  TotalsData,
} from '../../domain/value-objects/totals-data';
import { discountXml } from './dfe-lines-xml';
import { element, escapeAttribute, escapeXml } from './xml-core';

export function totalsXml(totals: TotalsData): string {
  return `<Totals>${element('PriceExtensionTotalAmount', totals.priceExtensionTotalAmount)}${element(
    'ChargeTotalAmount',
    totals.chargeTotalAmount,
  )}${element('DiscountTotalAmount', totals.discountTotalAmount)}${element(
    'NetTotalAmount',
    totals.netTotalAmount,
  )}${discountXml(totals.discount)}${element('TaxTotalAmount', totals.taxTotalAmount)}${element(
    'WithholdingTaxTotalAmount',
    totals.withholdingTaxTotalAmount,
  )}${element('PayableRoundingAmount', totals.payableRoundingAmount)}${element(
    'PayableAmount',
    totals.payableAmount,
  )}${totals.payableAlternativeAmounts.map(payableAlternativeAmountXml).join('')}</Totals>`;
}

function payableAlternativeAmountXml(amount: PayableAlternativeAmountData): string {
  return `<PayableAlternativeAmount CurrencyCode="${escapeAttribute(
    amount.currencyCode,
  )}" ExchangeRate="${escapeAttribute(amount.exchangeRate)}">${escapeXml(
    amount.value,
  )}</PayableAlternativeAmount>`;
}
