import Decimal from 'decimal.js';
import type { ExchangeRateQuote } from '../../core/contracts/exchange-rate-provider';
import { ExchangeRateError } from '../../domain/currency/exchange-rate-error';
import type { DiscountData } from '../../domain/value-objects/discount-data';
import type { InvoiceData } from '../../domain/value-objects/invoice-data';
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

  const converted: InvoiceData = {
    ...invoice,
    lines: invoice.lines.map((line) => ({
      ...line,
      price: convertAmount(line.price, rate),
      priceExtension: convertAmount(line.priceExtension, rate),
      discount: convertDiscount(line.discount, rate),
      netTotal: convertAmount(line.netTotal, rate),
      taxes: line.taxes.map((tax) => convertTax(tax, rate)),
    })),
    references: invoice.references.map((reference) => ({
      ...reference,
      paymentAmount: convertAmount(reference.paymentAmount, rate),
      tax: reference.tax === null ? null : convertTax(reference.tax, rate),
    })),
    payments: convertPayments(invoice.payments, rate),
    totals: convertTotals(invoice.totals, quote, rate),
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
): TotalsData | null {
  if (totals === null) {
    return null;
  }

  return {
    ...totals,
    priceExtensionTotalAmount: convertAmount(totals.priceExtensionTotalAmount, rate) ?? 0,
    chargeTotalAmount: convertAmount(totals.chargeTotalAmount, rate),
    discountTotalAmount: convertAmount(totals.discountTotalAmount, rate),
    netTotalAmount: convertAmount(totals.netTotalAmount, rate) ?? 0,
    discount: convertDiscount(totals.discount, rate),
    taxTotalAmount: convertAmount(totals.taxTotalAmount, rate) ?? 0,
    withholdingTaxTotalAmount: convertAmount(totals.withholdingTaxTotalAmount, rate),
    payableRoundingAmount: convertAmount(totals.payableRoundingAmount, rate),
    payableAmount: convertAmount(totals.payableAmount, rate) ?? 0,
    payableAlternativeAmounts: [
      {
        value: totals.payableAmount,
        currencyCode: quote.sourceCurrency,
        exchangeRate: quote.rate,
      },
    ],
  };
}
