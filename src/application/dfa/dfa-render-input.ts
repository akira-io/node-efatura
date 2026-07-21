import Decimal from 'decimal.js';
import type {
  CurrencyConversionMetadata,
  DfaLineInput,
  DfaRenderInput,
  DfaTotalsInput,
} from '../../core/contracts';
import { validateExchangeRateQuote } from '../../domain/currency/exchange-rate-quote';
import { documentTypeCode } from '../../domain/enums/document-type';
import { normalizeEmissionMode } from '../../domain/enums/emission-mode';
import { EfaturaValidationError } from '../../domain/errors';
import { parseIud } from '../../domain/iud/iud';
import type { AddressData } from '../../domain/value-objects/address-data';
import type { ContactsData } from '../../domain/value-objects/contacts-data';
import type { InvoiceData } from '../../domain/value-objects/invoice-data';
import type { LineItemData } from '../../domain/value-objects/line-item-data';
import type { TotalsData } from '../../domain/value-objects/totals-data';
import type { RenderDfaOptions } from '../efatura-options';

export function dfaRenderInputFrom(options: RenderDfaOptions, qrCodeUrl: string): DfaRenderInput {
  const parsedIud = parseIud(options.iud);
  const conversion = validatedConversion(options.invoice, options.conversion);

  return {
    iud: options.iud,
    qrCodeUrl,
    title: options.title,
    documentTypeCode: options.invoice ? documentTypeCode(options.invoice.type) : undefined,
    series: options.invoice?.serie ?? undefined,
    documentNumber:
      options.invoice?.innerDocumentNumber ?? trimLeadingZeros(parsedIud.documentNumber),
    issueDate: options.invoice?.issueDate,
    issueTime: options.invoice?.issueTime,
    issuerTaxId: options.invoice?.emitter.taxId?.value,
    issuerName: options.invoice?.emitter.name ?? undefined,
    issuerAddress: addressText(options.invoice?.emitter.address),
    issuerContact: contactText(options.invoice?.emitter.contacts),
    customerTaxId: options.invoice?.receiver?.taxId?.value,
    customerName: options.invoice?.receiver?.name ?? undefined,
    customerAddress: addressText(options.invoice?.receiver?.address),
    customerContact: contactText(options.invoice?.receiver?.contacts),
    lines: options.invoice?.lines.map(dfaLineFrom),
    totals: dfaTotalsFromInvoice(options.invoice),
    total: options.invoice?.totals?.payableAmount,
    currency: options.invoice ? 'CVE' : normalizeLegacyCurrency(options.currency),
    conversion,
    emissionMode: normalizeEmissionMode(options.emissionMode),
    contingencyIuc: options.contingencyIuc ?? options.invoice?.contingency?.iuc ?? undefined,
  };
}

function validatedConversion(
  invoice: InvoiceData | undefined,
  conversion: CurrencyConversionMetadata | undefined,
): CurrencyConversionMetadata | undefined {
  if (conversion === undefined) {
    return undefined;
  }

  try {
    if (invoice?.totals === null || invoice?.totals === undefined) {
      throw invalidDfaConversion();
    }

    const quote = validateExchangeRateQuote(
      {
        sourceCurrency: conversion.sourceCurrency,
        targetCurrency: 'CVE',
        rateType: conversion.rateType,
        effectiveAt: conversion.effectiveAt,
      },
      conversion,
    );

    if (
      quote.targetCurrency !== 'CVE' ||
      !isNonnegativeAmount(conversion.originalPayableAmount) ||
      !isNonnegativeAmount(conversion.convertedPayableAmount) ||
      !hasConsistentConvertedPayableAmount(conversion, quote.rate) ||
      conversion.convertedPayableAmount !== invoice.totals.payableAmount
    ) {
      throw invalidDfaConversion();
    }

    assertAlternativeAmountAgreement(invoice.totals, conversion, quote.rate);

    return {
      ...conversion,
      ...quote,
      originalPayableAmount: conversion.originalPayableAmount,
      convertedPayableAmount: conversion.convertedPayableAmount,
    };
  } catch {
    throw invalidDfaConversion();
  }
}

function hasConsistentConvertedPayableAmount(
  conversion: CurrencyConversionMetadata,
  normalizedRate: number,
): boolean {
  return new Decimal(conversion.originalPayableAmount)
    .mul(normalizedRate)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .equals(conversion.convertedPayableAmount);
}

function assertAlternativeAmountAgreement(
  totals: TotalsData,
  conversion: CurrencyConversionMetadata,
  normalizedRate: number,
): void {
  if (conversion.sourceCurrency.trim().toUpperCase() === 'CVE') {
    if (
      normalizedRate !== 1 ||
      conversion.originalPayableAmount !== totals.payableAmount ||
      conversion.convertedPayableAmount !== totals.payableAmount
    ) {
      throw invalidDfaConversion();
    }

    return;
  }

  const alternative = totals.payableAlternativeAmounts[0];

  if (
    totals.payableAlternativeAmounts.length !== 1 ||
    alternative?.currencyCode !== conversion.sourceCurrency.trim().toUpperCase() ||
    alternative.value !== conversion.originalPayableAmount ||
    alternative.exchangeRate !== normalizedRate
  ) {
    throw invalidDfaConversion();
  }
}

function isNonnegativeAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount >= 0;
}

function invalidDfaConversion(): EfaturaValidationError {
  return new EfaturaValidationError(
    'conversion',
    'DFA conversion metadata must match the invoice payable values.',
    'dfa.conversion_invalid',
  );
}

function normalizeLegacyCurrency(currency: string | undefined): 'CVE' | undefined {
  if (currency === undefined) {
    return undefined;
  }

  if (currency.trim().toUpperCase() === 'CVE') {
    return 'CVE';
  }

  throw new EfaturaValidationError(
    'currency',
    'DFA fiscal values must use CVE.',
    'dfa.currency_invalid',
  );
}

function trimLeadingZeros(value: string): string {
  return String(Number(value));
}

function addressText(address: AddressData | null | undefined): string | undefined {
  return address?.addressDetail;
}

function contactText(contacts: ContactsData | null | undefined): string | undefined {
  return contacts?.email ?? contacts?.mobilephone ?? contacts?.telephone ?? undefined;
}

function dfaLineFrom(line: LineItemData): DfaLineInput {
  return {
    code: line.item.emitterIdentification,
    description: line.item.description,
    quantity: line.quantity.value,
    unitCode: line.quantity.unitCode,
    unitPrice: line.price ?? 0,
    netTotal: line.netTotal ?? 0,
    taxTotal: line.taxes.reduce((total, tax) => total + (tax.taxTotal ?? 0), 0),
  };
}

function dfaTotalsFromInvoice(invoice: InvoiceData | undefined): DfaTotalsInput | undefined {
  return invoice?.totals ? dfaTotalsFrom(invoice.totals) : undefined;
}

function dfaTotalsFrom(totals: TotalsData): DfaTotalsInput {
  return {
    priceExtensionTotalAmount: totals.priceExtensionTotalAmount,
    chargeTotalAmount: totals.chargeTotalAmount ?? 0,
    discountTotalAmount: totals.discountTotalAmount ?? 0,
    netTotalAmount: totals.netTotalAmount,
    taxTotalAmount: totals.taxTotalAmount,
    payableAmount: totals.payableAmount,
  };
}
