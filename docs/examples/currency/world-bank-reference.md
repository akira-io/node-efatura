# World Bank Reference Provider

Use `WorldBankExchangeRateProvider` only when the application has approved an annual reference-rate policy. It is opt-in and never replaces the BCV fiscal default automatically.

```ts
import { WorldBankExchangeRateProvider, createEfatura } from '@akira-io/efatura';

const provider = new WorldBankExchangeRateProvider({
  economyByCurrency: {
    EUR: 'EMU',
  },
});

const efatura = createEfatura(config, { exchangeRateProvider: provider });
const prepared = await efatura.prepareInvoiceToCve(invoiceInEur, {
  sourceCurrency: 'EUR',
  rateType: 'reference',
});
```

The provider reads the World Bank `PA.NUS.FCRF` annual reference indicator for the source and target economies, then returns the normalized CVE-per-EUR multiplier. `CVE` is permanently mapped to the Cabo Verde economy code `CPV`. EUR requires the explicit `EUR: 'EMU'` mapping shown above.

The quote records both observation legs as evidence. Persist that evidence with `prepared.conversion`. World Bank data is annual reference data, not a BCV daily quote, and the package does not select it after a BCV failure.

See [Currency Conversion](../../18-currency-conversion.md) for supported mappings, observation periods, evidence fields, and fiscal policy limitations.
