import type {
  ExchangeRateProvider,
  ExchangeRateQuote,
  ExchangeRateRequest,
} from '../../core/contracts/exchange-rate-provider';
import { ExchangeRateError } from '../../domain/currency/exchange-rate-error';
import { validateExchangeRateQuote } from '../../domain/currency/exchange-rate-quote';

export type ExchangeRateCallback = (request: ExchangeRateRequest) => Promise<ExchangeRateQuote>;

export class CallbackExchangeRateProvider implements ExchangeRateProvider {
  constructor(private readonly callback: ExchangeRateCallback) {}

  async getQuote(request: ExchangeRateRequest): Promise<ExchangeRateQuote> {
    try {
      return validateExchangeRateQuote(request, await this.callback(request));
    } catch (error) {
      if (error instanceof ExchangeRateError) {
        throw error;
      }

      throw new ExchangeRateError(
        'exchange_rate.provider_unavailable',
        'The custom exchange-rate provider failed.',
        { cause: error },
      );
    }
  }
}
