# API Reference

The root package exports a framework-agnostic facade through `createEfatura(config, dependencies)`. The facade validates domain payloads, builds XML, signs documents, packages ZIP payloads, renders DFA PDFs, and delegates transport calls to injected infrastructure.

```ts
import { createEfatura } from '@akira-io/efatura';

const efatura = createEfatura(config, dependencies);
```

## Configuration And Dependencies

`config` identifies the transmitter, software, base URLs, and environment. `dependencies` replaces infrastructure contracts such as sequence storage, XML signing, XSD validation, DFA rendering, and fiscal authority clients.

See [Configuration](02-configuration.md) and [Storage](09-storage.md) for setup details.

## Invoice Builder

```ts
const invoice = efatura
  .invoice()
  .type('FTE')
  .issueDate('2026-02-08')
  .receiver({ taxId: { countryCode: 'CV', value: '900800700' }, name: 'Receiver' })
  .line({
    quantity: { value: 1, unitCode: 'UN' },
    price: 1000,
    priceExtension: 1000,
    netTotal: 1000,
    taxes: [{ taxTypeCode: 'IVA', taxPercentage: 15, taxTotal: 150 }],
    item: { description: 'Service', emitterIdentification: 'SERV-001' },
  })
  .totals({
    priceExtensionTotalAmount: 1000,
    netTotalAmount: 1000,
    taxTotalAmount: 150,
    payableAmount: 1150,
  })
  .validate();
```

`validate()` returns normalized `InvoiceData` or throws `EfaturaValidationError`.

## Numbering And IDs

| Method | Purpose |
|--------|---------|
| `generateSubmissionId()` | Creates a submission identifier from configured generators |
| `generateBatchId()` | Creates a batch identifier from configured generators |
| `nextDocumentNumber(issueDate, documentType)` | Allocates the next sequence number for the configured transmitter and LED |
| `buildIud(input)` | Builds an IUD from explicit document data |
| `buildSequentialIud(input)` | Allocates the next number, then builds the IUD |
| `buildEventId(input)` | Builds the official 24-character Event ID |

`buildIud()` fills `repositoryCode`, `emitterNif`, and `led` from configuration when they are omitted.

## XML

```ts
const xml = efatura.buildDfeXml(invoice, {
  documentNumber: 1,
  randomCode: '1234567890',
  emissionMode: 'Online',
});
```

`buildDfeXml(data, options)` accepts raw invoice records or normalized `InvoiceData`. It validates the invoice, validates issue-date tolerance, checks contingency consistency, creates or uses the IUD, then returns DFE XML.

Options:

| Option | Purpose |
|--------|---------|
| `iud` | Use an existing IUD instead of generating one |
| `documentNumber` | Required when `iud` is not supplied |
| `randomCode` | Optional IUD random code |
| `emissionMode` | `Online`, `Offline`, or `Off` |

Validation helpers:

```ts
await efatura.validateDfeXml(xml, 'FTE');
await efatura.validateEventXml(eventXml);
```

XSD validation uses the configured `xsdValidator`. Without a concrete validator, the default missing validator reports that official XSD validation is not configured.

## Currency Conversion

### Facade Method

```ts
const prepared = await efatura.prepareInvoiceToCve(invoiceInEur, {
  sourceCurrency: 'EUR',
  effectiveAt: new Date('2026-07-21T11:30:00.000Z'),
  rateType: 'buy',
});
```

`prepareInvoiceToCve(data, options): Promise<PreparedCurrencyInvoice>` accepts a raw invoice record or `InvoiceData`. It validates the source, resolves one quote targeting CVE, returns a new converted invoice, and validates that projection again. It does not mutate the input.

`PrepareInvoiceToCveOptions`:

| Field | Type | Required | Default |
|---|---|---|---|
| `sourceCurrency` | `string` | yes | none; trimmed and uppercased |
| `effectiveAt` | `Date` | no | invoice issue date and time in Cape Verde time; midnight when time is absent |
| `rateType` | `ExchangeRateType` | no | provider-specific; BCV uses `buy` |

`PreparedCurrencyInvoice`:

| Field | Type | Meaning |
|---|---|---|
| `invoice` | `InvoiceData` | New normalized CVE projection |
| `conversion` | `CurrencyConversionMetadata` | Quote plus original and converted payable values |

`CurrencyConversionMetadata` extends `ExchangeRateQuote` with `originalPayableAmount` and `convertedPayableAmount`, both numbers.

### Provider Contract

```ts
type ExchangeRateType = 'buy' | 'sell' | 'reference' | 'custom';

interface ExchangeRateProvider {
  getQuote(request: ExchangeRateRequest): Promise<ExchangeRateQuote>;
}
```

`ExchangeRateRequest` fields:

| Field | Type | Required | Meaning |
|---|---|---|---|
| `sourceCurrency` | `string` | yes | Currency multiplied by the rate |
| `targetCurrency` | `string` | yes | Result currency; fiscal preparation fixes this to `CVE` |
| `effectiveAt` | `Date` | yes | Latest acceptable quote date |
| `rateType` | `ExchangeRateType` | no | Requested buy, sell, reference, or custom type |

`ExchangeRateQuote` fields:

| Field | Type | Required | Meaning |
|---|---|---|---|
| `sourceCurrency` | `string` | yes | Normalized source code |
| `targetCurrency` | `string` | yes | Normalized target code |
| `rate` | `number` | yes | Positive source-to-target multiplier, normalized to five fractional digits |
| `rateType` | `ExchangeRateType` | yes | Applied quote type |
| `effectiveAt` | `Date` | yes | Publication or observation date |
| `retrievedAt` | `Date` | yes | Time the source was retrieved |
| `provider` | `string` | yes | Non-empty source identity |
| `sourceUrl` | `string` | no | HTTPS evidence URL |

Rate direction is `amountInTarget = amountInSource * rate`.

`normalizeCurrencyCode(currencyCode)` trims and uppercases a code. `validateExchangeRateQuote(request, quote)` verifies the pair, requested rate type, dates, provider, optional HTTPS source URL, and positive rate, then returns a normalized `ExchangeRateQuote`.

Set `EfaturaDependencies.exchangeRateProvider` in the second `createEfatura()` argument to replace the provider. Omission constructs `BcvExchangeRateProvider` with the facade clock.

### `BcvExchangeRateProvider`

```ts
new BcvExchangeRateProvider(options?: BcvExchangeRateProviderOptions)
```

| Option | Type | Default |
|---|---|---|
| `fetcher` | `typeof fetch` | global `fetch` |
| `clock` | `Clock` | `SystemClock` |
| `sourceUrl` | `string` | official BCV dated print page |
| `timeoutMs` | `number` | `10000` |
| `maxResponseBytes` | `number` | `1048576` |
| `allowPreviousPublication` | `boolean` | `false` |
| `maxPublicationAgeDays` | `number` | `0` |

`getQuote()` supports buy and sell quotes targeting CVE and defaults to buy when called without a rate type. It normalizes rates published for multiple units. Previous publications require both an enabled policy and an adequate maximum age. The current BCV page is dynamic and is not a documented historical API.

### `WorldBankExchangeRateProvider`

```ts
new WorldBankExchangeRateProvider(options?: WorldBankExchangeRateProviderOptions)
```

| Option | Type | Default |
|---|---|---|
| `fetcher` | `typeof fetch` | global `fetch` |
| `clock` | `Clock` | `SystemClock` |
| `economyByCurrency` | `Readonly<Record<string, string>>` | `{ CVE: 'CPV' }` |
| `indicator` | `string` | `PA.NUS.FCRF` |
| `baseUrl` | `string` | `https://api.worldbank.org` |
| `timeoutMs` | `number` | `10000` |
| `maxResponseBytes` | `number` | `1048576` |

The provider supports `reference` quotes only and uses annual observations for one UTC year. USD needs no mapping; other source currencies need an explicit economy mapping. World Bank is an annual reference source, not a fiscal daily default.

### `FixedExchangeRateProvider`

```ts
new FixedExchangeRateProvider(options: FixedExchangeRateProviderOptions)
```

| Option | Type | Required | Default |
|---|---|---|---|
| `sourceCurrency` | `string` | yes | none |
| `targetCurrency` | `string` | yes | none |
| `rate` | `number` | yes | none |
| `effectiveAt` | `Date` | yes | none |
| `retrievedAt` | `Date` | no | `effectiveAt` |
| `rateType` | `ExchangeRateType` | no | `custom` |
| `provider` | `string` | yes | none |
| `sourceUrl` | `string` | no | omitted |

The constructor validates and stores one quote. `getQuote()` rejects a different pair, rate type, or an effective date earlier than the stored quote.

### `CallbackExchangeRateProvider`

```ts
type ExchangeRateCallback = (
  request: ExchangeRateRequest,
) => Promise<ExchangeRateQuote>;

new CallbackExchangeRateProvider(callback: ExchangeRateCallback)
```

The callback result is validated against the request. Existing `ExchangeRateError` instances pass through. Other callback failures become `exchange_rate.provider_unavailable` with the original failure as the cause.

### `ExchangeRateError`

```ts
new ExchangeRateError(
  code: ExchangeRateErrorCode,
  message: string,
  options?: { cause?: unknown },
)
```

`ExchangeRateErrorCode` contains:

| Code | Meaning |
|---|---|
| `exchange_rate.provider_unavailable` | Provider transport or callback failed |
| `exchange_rate.response_invalid` | Provider content or quote shape is invalid |
| `exchange_rate.currency_unsupported` | Provider lacks the requested currency or mapping |
| `exchange_rate.pair_mismatch` | Pair or requested rate type does not match |
| `exchange_rate.rate_invalid` | Rate is non-positive, non-finite, or rounds to zero |
| `exchange_rate.date_unavailable` | Quote is later than requested or no allowed date exists |
| `exchange_rate.date_invalid` | Requested or returned date is invalid |
| `exchange_rate.stale` | BCV publication exceeds maximum age |
| `exchange_rate.source_required` | Required source configuration is not valid HTTPS provenance |
| `exchange_rate.invoice_invalid` | Converted projection fails fiscal validation |
| `exchange_rate.alternatives_conflict` | Existing alternative amounts prevent safe conversion |

No provider silently falls back to another source. See [Currency Conversion](18-currency-conversion.md) for provider policy, monetary fields, audit storage, and recovery decisions.

## Events

```ts
const eventXml = efatura.buildEventXml({
  type: 'FDC',
  issueDateTime: '2026-02-08T11:30:00',
  issueReasonDescription: 'Documento emitido com dados incorretos.',
  iuds: [iud],
});
```

`validateEvent(data)` normalizes event payloads. `buildEventXml(data, options)` builds official Event XML for `FDC` and `UDN`. See [Events](15-events.md).

## Signing And Certificates

```ts
const signed = await efatura.signDfeXml(xml, {
  certificate: process.env.EFATURA_CERTIFICATE_PEM,
  privateKey: process.env.EFATURA_PRIVATE_KEY_PEM,
});
```

| Method | Purpose |
|--------|---------|
| `signDfeXml(xml, options)` | Signs DFE XML with the configured signer |
| `signEventXml(xml, options)` | Signs Event XML with the configured signer |
| `validateCertificate(input)` | Validates certificate material through the configured certificate validator |

The default XAdES-BES signer requires certificate and private key material. See [Signing And Certificates](16-signing-certificates.md).

## ZIP And Submission

```ts
const zip = efatura.buildDfeZip([{ iud, xml: signed.xml }]);
const result = await efatura.submitDfeZip(zip);
```

| Method | Purpose |
|--------|---------|
| `buildDfeZip(files)` | Creates a Deflate ZIP with `{IUD}.xml` entries |
| `submitDfeZip(zip)` | Submits through the configured middleware transport |
| `submitDfeZipToPlatform(zip, options)` | Submits through the configured platform transport |

`submitDfeZip()` requires `transmitterKey` in config. `submitDfeZipToPlatform()` requires an OAuth access token in options.

See [Packaging](07-packaging.md).

## DFA

```ts
const document = await efatura.renderDfa({
  iud,
  invoice,
});
```

| Method | Purpose |
|--------|---------|
| `dfaQrCodeUrl(iud)` | Builds the official DFA lookup URL from `dfaBaseUrl` |
| `renderDfa(options)` | Renders a PDF through the configured DFA renderer |

`RenderDfaOptions.conversion?: CurrencyConversionMetadata` supplies conversion evidence to the default or custom renderer. `DfaRenderInput.conversion` exposes the same optional field. `RenderDfaOptions.currency` is deprecated because fiscal values are always CVE. Remove it when an invoice is supplied; a foreign value in IUD-only rendering throws `dfa.currency_invalid`.

The default renderer returns:

```ts
{
  contentType: 'application/pdf',
  filename: `${iud}.pdf`,
  buffer: Buffer
}
```

See [DFA](14-dfa.md).

## Fiscal Readiness

```ts
const readiness = await efatura.validateFiscalReadiness(invoice, {
  accessToken: process.env.EFATURA_ACCESS_TOKEN,
});
```

Without `accessToken`, external PE and DNRE checks return `skipped`. With a token, the configured clients check taxpayer status, software registration, and emitter authorization.

## Errors

Domain and presentation failures use `EfaturaValidationError`. Official artifacts missing from the local package use `OfficialArtifactMissingError`. Catch these at adapter boundaries and convert them into application-specific HTTP or job errors.
