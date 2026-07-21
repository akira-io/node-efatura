import type {
  Clock,
  ExchangeRateProvider,
  ExchangeRateQuote,
  ExchangeRateRequest,
} from '../../core/contracts';
import { ExchangeRateError } from '../../domain/currency/exchange-rate-error';
import {
  normalizeCurrencyCode,
  validateExchangeRateQuote,
} from '../../domain/currency/exchange-rate-quote';
import type { InvoiceData } from '../../domain/value-objects/invoice-data';
import { parseIssueDateTime } from '../issue-date-validation';
import { convertInvoiceToCve } from './convert-invoice-to-cve';
import type {
  PreparedCurrencyInvoice,
  PrepareInvoiceToCveOptions,
} from './currency-conversion-types';

export interface PrepareInvoiceToCveDependencies {
  provider: ExchangeRateProvider;
  clock: Clock;
  validateInvoice: (candidate: InvoiceData) => InvoiceData;
}

export async function prepareInvoiceToCve(
  invoice: InvoiceData,
  options: PrepareInvoiceToCveOptions,
  dependencies: PrepareInvoiceToCveDependencies,
): Promise<PreparedCurrencyInvoice> {
  const sourceCurrency = sourceCurrencyFrom(options.sourceCurrency);
  const effectiveAt = effectiveAtFrom(invoice, options.effectiveAt);

  if (sourceCurrency === 'CVE') {
    return prepareIdentityInvoice(invoice, effectiveAt, dependencies);
  }

  const request: ExchangeRateRequest = {
    sourceCurrency,
    targetCurrency: 'CVE',
    effectiveAt,
    rateType: options.rateType,
  };
  const quote = validateExchangeRateQuote(request, await dependencies.provider.getQuote(request));
  const prepared = convertInvoiceToCve(invoice, quote);

  return {
    ...prepared,
    invoice: validateConvertedInvoice(prepared.invoice, dependencies.validateInvoice),
  };
}

function prepareIdentityInvoice(
  invoice: InvoiceData,
  effectiveAt: Date,
  dependencies: PrepareInvoiceToCveDependencies,
): PreparedCurrencyInvoice {
  const request: ExchangeRateRequest = {
    sourceCurrency: 'CVE',
    targetCurrency: 'CVE',
    effectiveAt,
  };
  const quote = validateExchangeRateQuote(request, identityQuote(effectiveAt, dependencies.clock));
  const normalizedInvoice = validateConvertedInvoice(invoice, dependencies.validateInvoice);
  const payableAmount = normalizedInvoice.totals?.payableAmount ?? 0;

  return {
    invoice: normalizedInvoice,
    conversion: {
      ...quote,
      originalPayableAmount: payableAmount,
      convertedPayableAmount: payableAmount,
    },
  };
}

function identityQuote(effectiveAt: Date, clock: Clock): ExchangeRateQuote {
  return {
    sourceCurrency: 'CVE',
    targetCurrency: 'CVE',
    rate: 1,
    rateType: 'reference',
    effectiveAt: new Date(effectiveAt),
    retrievedAt: clock.now(),
    provider: 'identity',
  };
}

function sourceCurrencyFrom(value: string): string {
  const sourceCurrency = normalizeCurrencyCode(value);

  if (!/^[A-Z]{3}$/.test(sourceCurrency)) {
    throw new ExchangeRateError(
      'exchange_rate.currency_unsupported',
      'Source currency must be a three-letter alphabetic code.',
    );
  }

  return sourceCurrency;
}

function effectiveAtFrom(invoice: InvoiceData, override: Date | undefined): Date {
  if (override === undefined) {
    return parseIssueDateTime(invoice.issueDate, invoice.issueTime);
  }

  const timestamp = override instanceof Date ? override.getTime() : Number.NaN;

  if (!Number.isFinite(timestamp)) {
    throw new ExchangeRateError(
      'exchange_rate.date_invalid',
      'Effective date must be a valid date.',
    );
  }

  return new Date(timestamp);
}

function validateConvertedInvoice(
  invoice: InvoiceData,
  validateInvoice: (candidate: InvoiceData) => InvoiceData,
): InvoiceData {
  try {
    return validateInvoice(invoice);
  } catch (cause) {
    throw new ExchangeRateError(
      'exchange_rate.invoice_invalid',
      'Converted invoice failed fiscal validation.',
      { cause },
    );
  }
}
