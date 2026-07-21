# EUR To CVE With A Fixed Rate

This example prepares a EUR invoice with an audited fixed rate, builds DFE XML, and renders the DFA from the same prepared result. It does not make a network request. The block below reproduces the [canonical TypeScript source](eur-to-cve.ts). The documentation test checks the complete block and runs that source against the public package exports.

```ts
import { FixedExchangeRateProvider, createEfatura } from '@akira-io/efatura';

const iud = 'CV3260208100200300001230100000000112345678909';
const effectiveAt = new Date('2026-07-21T00:00:00.000Z');
const efatura = createEfatura(
  {
    transmitterNif: '100200300',
    transmitterLed: '123',
    softwareCode: 'SW001',
    softwareName: 'Efatura Suite',
    softwareVersion: '1.0.0',
    middlewareBaseUrl: 'https://middleware.example',
  },
  {
    clock: { now: () => new Date('2026-07-21T12:00:00.000Z') },
    exchangeRateProvider: new FixedExchangeRateProvider({
      sourceCurrency: 'EUR',
      targetCurrency: 'CVE',
      rate: 110.265,
      effectiveAt,
      provider: 'Rate approved by the accounting team',
      sourceUrl: 'https://internal.example/rates/2026-07-21',
    }),
  },
);

const invoiceInEur = {
  type: 'FTE',
  issueDate: '2026-07-21',
  issueTime: '11:30:00',
  serie: 'SER-F',
  emitter: {
    taxId: { countryCode: 'CV', value: '100200300' },
    name: 'Emitter',
    address: { countryCode: 'CV', addressDetail: 'Praia' },
    contacts: { email: 'issuer@example.cv', telephone: '2600000' },
  },
  receiver: {
    taxId: { countryCode: 'CV', value: '900800700' },
    name: 'Receiver',
    address: { countryCode: 'CV', addressDetail: 'Mindelo' },
    contacts: { email: 'receiver@example.cv', telephone: '2300000' },
  },
  lines: [
    {
      lineTypeCode: 'N',
      quantity: { value: 1, unitCode: 'EA' },
      price: 173.91,
      priceExtension: 173.91,
      netTotal: 173.91,
      taxes: [{ taxTypeCode: 'IVA', taxPercentage: 15, taxTotal: 26.09 }],
      item: { description: 'Service', emitterIdentification: 'SERV-001' },
    },
  ],
  totals: {
    priceExtensionTotalAmount: 173.91,
    chargeTotalAmount: 0,
    discountTotalAmount: 0,
    netTotalAmount: 173.91,
    taxTotalAmount: 26.09,
    payableAmount: 200,
  },
};

export const prepared = await efatura.prepareInvoiceToCve(invoiceInEur, {
  sourceCurrency: 'EUR',
});
export const xml = efatura.buildDfeXml(prepared.invoice, { iud });
export const dfa = await efatura.renderDfa({
  iud,
  invoice: prepared.invoice,
  conversion: prepared.conversion,
});
```

The exported values contain a converted payable amount of `22053`, XML with the CVE payable amount, and a DFA with the `application/pdf` content type.

The generated XML contains the CVE payable amount and the original EUR amount:

```xml
<PayableAmount>22053</PayableAmount>
<PayableAlternativeAmount CurrencyCode="EUR" ExchangeRate="110.265">200</PayableAlternativeAmount>
```

Persist `prepared.invoice` and `prepared.conversion` with the fiscal record. Reuse both values when the DFA is rendered again.

See [Currency Conversion](../../18-currency-conversion.md) for provider policies, precision rules, the complete issuance flow, and recovery decisions.
