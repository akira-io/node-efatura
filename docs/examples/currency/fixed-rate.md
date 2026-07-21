# Fixed Rate Provider

Use `FixedExchangeRateProvider` when accounting has approved a specific rate and its evidence outside the package. The provider is deterministic and makes no network request.

```ts
import { FixedExchangeRateProvider, createEfatura } from '@akira-io/efatura';

const provider = new FixedExchangeRateProvider({
  sourceCurrency: 'EUR',
  targetCurrency: 'CVE',
  rate: 110.265,
  effectiveAt: new Date('2026-07-21T00:00:00.000Z'),
  retrievedAt: new Date('2026-07-21T10:00:00.000Z'),
  rateType: 'custom',
  provider: 'Rate approved by the accounting team',
  sourceUrl: 'https://internal.example/rates/2026-07-21',
});

const efatura = createEfatura(config, { exchangeRateProvider: provider });
const prepared = await efatura.prepareInvoiceToCve(invoiceInEur, {
  sourceCurrency: 'EUR',
  rateType: 'custom',
});
```

The configured currency pair and rate type must match the preparation request. The requested effective date cannot precede the configured quote date. `provider` and `sourceUrl` must identify the evidence that accounting approved.

The [complete EUR-to-CVE example](eur-to-cve.md) provides a runnable invoice, builds the DFE XML, renders the DFA, and verifies the original EUR payable amount without network access.

See [Currency Conversion](../../18-currency-conversion.md) for constructor fields, validation rules, precision, and audit persistence.
