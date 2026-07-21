# Callback Provider

Use `CallbackExchangeRateProvider` to connect an application-owned treasury service, approved database, or explicit provider-selection policy to the package contract.

```ts
import { CallbackExchangeRateProvider, createEfatura } from '@akira-io/efatura';

const provider = new CallbackExchangeRateProvider(async (request) => {
  const rate = await applicationRates.getApprovedQuote(request);

  return {
    sourceCurrency: request.sourceCurrency,
    targetCurrency: request.targetCurrency,
    rate: rate.value,
    rateType: rate.type,
    effectiveAt: rate.effectiveAt,
    retrievedAt: new Date(),
    provider: rate.providerName,
    sourceUrl: rate.auditUrl,
  };
});

const efatura = createEfatura(config, { exchangeRateProvider: provider });
const prepared = await efatura.prepareInvoiceToCve(invoiceInEur, {
  sourceCurrency: 'EUR',
  rateType: 'custom',
});
```

The callback result passes through the same pair, date, rate, provider-name, and HTTPS provenance validation as the built-in providers. An `ExchangeRateError` keeps its code; another thrown value becomes `exchange_rate.provider_unavailable`.

If the callback implements a provider sequence, its metadata must describe the quote that was selected, not a source that failed earlier. Authentication, authorization, caching, fallback decisions, and secret handling remain application responsibilities.

See [Currency Conversion](../../18-currency-conversion.md) for the callback contract, error behavior, provenance rules, and audit persistence.
