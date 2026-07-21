import type {
  CurrencyConversionMetadata,
  ExchangeRateType,
} from '../../core/contracts/exchange-rate-provider';
import type { InvoiceData } from '../../domain/value-objects/invoice-data';

export interface PrepareInvoiceToCveOptions {
  sourceCurrency: string;
  effectiveAt?: Date;
  rateType?: ExchangeRateType;
}

export interface PreparedCurrencyInvoice {
  invoice: InvoiceData;
  conversion: CurrencyConversionMetadata;
}
