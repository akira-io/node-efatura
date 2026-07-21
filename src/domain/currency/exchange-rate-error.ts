import { EfaturaError } from '../errors/efatura-error';

export type ExchangeRateErrorCode =
  | 'exchange_rate.provider_unavailable'
  | 'exchange_rate.response_invalid'
  | 'exchange_rate.currency_unsupported'
  | 'exchange_rate.pair_mismatch'
  | 'exchange_rate.rate_invalid'
  | 'exchange_rate.date_unavailable'
  | 'exchange_rate.date_invalid'
  | 'exchange_rate.stale'
  | 'exchange_rate.source_required'
  | 'exchange_rate.invoice_invalid'
  | 'exchange_rate.alternatives_conflict';

export class ExchangeRateError extends EfaturaError {
  constructor(
    readonly code: ExchangeRateErrorCode,
    message: string,
    options: { cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'ExchangeRateError';
  }
}
