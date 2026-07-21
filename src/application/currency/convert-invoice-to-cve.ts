import Decimal from 'decimal.js';
import type { ExchangeRateQuote } from '../../core/contracts/exchange-rate-provider';
import { ExchangeRateError } from '../../domain/currency/exchange-rate-error';
import type { DiscountData } from '../../domain/value-objects/discount-data';
import {
  roundMoney,
  sumSignedLineAmounts,
  taxTotalsFrom,
} from '../../domain/value-objects/invoice-amounts';
import type { InvoiceData } from '../../domain/value-objects/invoice-data';
import type { LineItemData } from '../../domain/value-objects/line-item-data';
import type { PaymentsData } from '../../domain/value-objects/payment-structures';
import type { TaxData } from '../../domain/value-objects/tax-data';
import type { TotalsData } from '../../domain/value-objects/totals-data';
import type { PreparedCurrencyInvoice } from './currency-conversion-types';

export function convertInvoiceToCve(
  invoice: InvoiceData,
  quote: ExchangeRateQuote,
): PreparedCurrencyInvoice {
  if (invoice.totals === null) {
    throw payableTotalsRequired();
  }

  const rate = new Decimal(quote.rate);

  if ((invoice.totals?.payableAlternativeAmounts.length ?? 0) > 0) {
    throw new ExchangeRateError(
      'exchange_rate.alternatives_conflict',
      'Invoice payable alternative amounts conflict with currency conversion.',
    );
  }

  const lines = invoice.lines.map((line) => ({
    ...line,
    price: convertAmount(line.price, rate),
    priceExtension: convertAmount(line.priceExtension, rate),
    discount: convertDiscount(line.discount, rate),
    netTotal: convertAmount(line.netTotal, rate),
    taxes: line.taxes.map((tax) => convertTax(tax, rate)),
  }));
  const converted: InvoiceData = {
    ...invoice,
    lines,
    references: invoice.references.map((reference) => ({
      ...reference,
      paymentAmount: convertAmount(reference.paymentAmount, rate),
      tax: reference.tax === null ? null : convertTax(reference.tax, rate),
    })),
    payments: convertPayments(invoice.payments, rate),
    totals: convertTotals(invoice.totals, quote, rate, lines),
  };

  const originalPayableAmount = invoice.totals.payableAmount;
  const convertedPayableAmount = converted.totals?.payableAmount;

  if (convertedPayableAmount === undefined) {
    throw payableTotalsRequired();
  }

  return {
    invoice: converted,
    conversion: {
      ...quote,
      effectiveAt: new Date(quote.effectiveAt),
      retrievedAt: new Date(quote.retrievedAt),
      originalPayableAmount,
      convertedPayableAmount,
    },
  };
}

function payableTotalsRequired(): ExchangeRateError {
  return new ExchangeRateError(
    'exchange_rate.invoice_invalid',
    'Invoice totals with a payable amount are required for currency conversion.',
  );
}

function convertAmount(value: number | null, rate: Decimal): number | null {
  if (value === null) {
    return null;
  }

  return new Decimal(value).mul(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

function convertDiscount(discount: DiscountData | null, rate: Decimal): DiscountData | null {
  if (discount === null || discount.valueType === 'P') {
    return discount;
  }

  return { ...discount, value: convertAmount(discount.value, rate) ?? 0 };
}

function convertTax(tax: TaxData, rate: Decimal): TaxData {
  return {
    ...tax,
    taxAmount: convertAmount(tax.taxAmount, rate),
    taxTotal: convertAmount(tax.taxTotal, rate),
  };
}

function convertPayments(payments: PaymentsData | null, rate: Decimal): PaymentsData | null {
  if (payments === null) {
    return null;
  }

  return {
    ...payments,
    payments: payments.payments.map((payment) => ({
      ...payment,
      paymentAmount: convertAmount(payment.paymentAmount, rate),
    })),
  };
}

function convertTotals(
  totals: TotalsData | null,
  quote: ExchangeRateQuote,
  rate: Decimal,
  lines: LineItemData[],
): TotalsData | null {
  if (totals === null) {
    return null;
  }

  const priceExtensionTotalAmount =
    sumSignedLineAmounts(lines, (line) => line.priceExtension) ??
    convertAmount(totals.priceExtensionTotalAmount, rate) ??
    0;
  const netTotalAmount =
    sumSignedLineAmounts(lines, (line) => line.netTotal) ??
    convertAmount(totals.netTotalAmount, rate) ??
    0;
  const lineTaxTotals = taxTotalsFrom(lines);
  const taxTotalAmount =
    lineTaxTotals.taxTotal?.[0] ?? convertAmount(totals.taxTotalAmount, rate) ?? 0;
  const withholdingTaxTotalAmount = lineTaxTotals.hasWithholdingTaxTotal
    ? (lineTaxTotals.withholdingTotal[0] ?? 0)
    : null;
  const payableAmount = convertAmount(totals.payableAmount, rate) ?? 0;
  const derivedPayableRoundingAmount = roundMoney(
    new Decimal(payableAmount)
      .minus(netTotalAmount)
      .minus(taxTotalAmount)
      .plus(withholdingTaxTotalAmount ?? 0),
  );
  const payableRoundingAmount =
    totals.payableRoundingAmount === null && derivedPayableRoundingAmount === 0
      ? null
      : derivedPayableRoundingAmount;

  return {
    ...totals,
    priceExtensionTotalAmount,
    chargeTotalAmount: convertAmount(totals.chargeTotalAmount, rate),
    discountTotalAmount: convertAmount(totals.discountTotalAmount, rate),
    netTotalAmount,
    discount: convertDiscount(totals.discount, rate),
    taxTotalAmount,
    withholdingTaxTotalAmount,
    payableRoundingAmount,
    payableAmount,
    payableAlternativeAmounts: [
      {
        value: totals.payableAmount,
        currencyCode: quote.sourceCurrency,
        exchangeRate: quote.rate,
      },
    ],
  };
}
