# BCV Default Provider

Use the Banco de Cabo Verde provider when the invoice must use the official daily fiscal exchange rate. `createEfatura(config)` selects `BcvExchangeRateProvider` automatically.

```ts
import { createEfatura } from '@akira-io/efatura';

const efatura = createEfatura(config);
const prepared = await efatura.prepareInvoiceToCve(invoiceInEur, {
  sourceCurrency: 'EUR',
  rateType: 'buy',
});

const xml = efatura.buildDfeXml(prepared.invoice, { iud });
const dfa = await efatura.renderDfa({
  iud,
  invoice: prepared.invoice,
  conversion: prepared.conversion,
});
```

The provider reads the official BCV publication for the requested Cape Verde date. By default, that publication date must match the invoice date. Weekend or public-holiday handling requires an explicit `allowPreviousPublication` policy and a maximum publication age.

BCV uses the buy rate unless `rateType: 'sell'` is requested. Its source origin is fixed to `https://www.bcv.cv`, and redirects are rejected. The package does not switch to another provider after a failure. Stop issuance or apply an explicit application policy.

This example performs a network request. Use the [complete EUR-to-CVE example](eur-to-cve.md) for a deterministic local run.

See [Currency Conversion](../../18-currency-conversion.md) for publication-date rules, timeout options, rate units, and audit requirements.
