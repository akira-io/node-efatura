# Currency Conversion

`@akira-io/efatura` prepares a foreign-currency application invoice as one fiscal CVE projection. The package obtains one normalized quote, converts first-class monetary fields, records the original payable amount, and returns the invoice and conversion evidence together.

The official basis is the [e-Fatura technical manual](https://efatura.cv/docs/manual/), the [technical manual v11.0](https://efatura.cv/assets/files/manual-tecnico-da-fatura-eletronica-v11.0-be67e62c7fb34552fbcc8eeea966e217.pdf), the [BCV exchange statistics page](https://www.bcv.cv/pt/PoliticaMonetaria/EstatisticasCambiais/Paginas/Estatisticas_Cambiais.aspx), and the XSD files embedded under `resources/xsd/efatura/2024-05-27`.

## 1. Fiscal Model: DFE In CVE And Alternative Payable Amount

A DFE is always issued in Cape Verde escudo. Conversion does not turn the DFE into a EUR, USD, or other foreign-currency document. All fiscal line amounts, taxes, totals, XML values, and primary DFA values in the prepared invoice are CVE.

For a foreign source invoice, `prepareInvoiceToCve()` adds one `PayableAlternativeAmount` to the converted totals. It records:

- the original payable value;
- the original ISO 4217 alphabetic currency code;
- the multiplier applied from the original currency to CVE.

For `200 EUR` at `110.265 CVE` per EUR, the fiscal payable amount is `22053 CVE` and the alternative amount is `200 EUR`:

```xml
<PayableAmount>22053</PayableAmount>
<PayableAlternativeAmount CurrencyCode="EUR" ExchangeRate="110.265">200</PayableAlternativeAmount>
```

The DFE XML has no official fields for the provider name, retrieval time, or source URL. Keep those fields in application audit storage and pass them to DFA rendering through trusted facade code.

When `sourceCurrency` is `CVE`, preparation uses an identity quote with rate `1`, provider `identity`, and rate type `reference`. It does not call the configured provider or add a CVE alternative amount.

## 2. Installation And Prerequisites

Install the package with Node.js 20 or newer:

```sh
npm install @akira-io/efatura
```

Currency preparation needs:

- a valid `createEfatura()` configuration;
- an `InvoiceData` value or raw invoice record that passes package validation;
- a source currency expressed as a three-letter code;
- a configured provider, or network access to BCV when the default provider is used.

The BCV and World Bank providers use the global `fetch` implementation available in Node.js 20. They require HTTPS and apply request timeouts and response-size limits. A fixed provider needs no network access. A callback provider uses the application service supplied by the consumer.

The later fiscal steps keep their existing prerequisites. XSD validation through `XmllintXsdValidator` requires `xmllint`. XAdES-BES signing requires valid certificate and private-key material. Middleware submission requires `transmitterKey`; direct platform submission requires an access token.

## 3. Default BCV Example

`createEfatura(config)` creates a `BcvExchangeRateProvider` when `exchangeRateProvider` is omitted. The facade and the provider share the configured clock.

```ts
import { createEfatura } from '@akira-io/efatura';

const efatura = createEfatura(config);
const prepared = await efatura.prepareInvoiceToCve(invoiceInEur, {
  sourceCurrency: 'EUR',
});
```

The facade derives `effectiveAt` from the invoice issue date and issue time in Cape Verde time. If the invoice has no issue time, it uses `00:00:00` in Cape Verde time. The default BCV request asks for a buy quote targeting CVE and requires the publication date to match the requested date.

The default path performs a network request. Use the fixed-provider example for a deterministic local run: [EUR To CVE With A Fixed Rate](examples/currency/eur-to-cve.md).

## 4. Complete Preparation, IUD, XML, XSD Validation, DFA, Signing, And Submission Flow

Resolve one quote before generating any fiscal representation. Use the returned `prepared.invoice` for XML and DFA, and pass `prepared.conversion` to DFA rendering.

```ts
import { EmissionMode, createEfatura } from '@akira-io/efatura';

const efatura = createEfatura(config);
const prepared = await efatura.prepareInvoiceToCve(invoiceInEur, {
  sourceCurrency: 'EUR',
});

const iud = await efatura.buildSequentialIud({
  issueDate: prepared.invoice.issueDate,
  documentType: prepared.invoice.type,
  randomCode: '1234567890',
});

const xml = efatura.buildDfeXml(prepared.invoice, {
  iud,
  emissionMode: EmissionMode.Online,
});

const validation = await efatura.validateDfeXml(xml, prepared.invoice.type);
if (!validation.valid) {
  throw new Error(validation.errors.map((error) => error.message).join('\n'));
}

const dfa = await efatura.renderDfa({
  iud,
  invoice: prepared.invoice,
  conversion: prepared.conversion,
  emissionMode: EmissionMode.Online,
});

const signed = await efatura.signDfeXml(xml, {
  certificate,
  privateKey,
});
const zip = efatura.buildDfeZip([{ iud, xml: signed.xml }]);
const submission = await efatura.submitDfeZip(zip);
```

Persist the prepared invoice, conversion metadata, IUD, unsigned XML, signed XML, DFA, ZIP, and submission response according to the application's audit policy. Do not request a second quote for DFA creation or a later reprint. `buildDfeXml()` remains synchronous and never performs conversion or provider access.

## 5. Provider Contract And Rate Direction

Providers implement one framework-agnostic contract:

```ts
export type ExchangeRateType = 'buy' | 'sell' | 'reference' | 'custom';

export interface ExchangeRateRequest {
  sourceCurrency: string;
  targetCurrency: string;
  effectiveAt: Date;
  rateType?: ExchangeRateType;
}

export interface ExchangeRateQuote {
  sourceCurrency: string;
  targetCurrency: string;
  rate: number;
  rateType: ExchangeRateType;
  effectiveAt: Date;
  retrievedAt: Date;
  provider: string;
  sourceUrl?: string;
}

export interface ExchangeRateProvider {
  getQuote(request: ExchangeRateRequest): Promise<ExchangeRateQuote>;
}
```

The rate direction is fixed:

```text
amountInTarget = amountInSource * rate
```

`110.265` for EUR to CVE means `1 EUR = 110.265 CVE`. Providers normalize upstream units, inverse rates, and cross rates before returning a quote.

The facade method accepts:

```ts
export interface PrepareInvoiceToCveOptions {
  sourceCurrency: string;
  effectiveAt?: Date;
  rateType?: ExchangeRateType;
}
```

`sourceCurrency` is required, trimmed, and uppercased. The target is fixed to `CVE`. `effectiveAt` defaults to the invoice issue date and time in Cape Verde time, using midnight when the invoice has no issue time. `rateType` is passed to the provider; the BCV provider defaults it to `buy`, while the World Bank provider defaults it to `reference` when called directly. A provider rejects unsupported types instead of reinterpreting them.

The result is:

```ts
export interface CurrencyConversionMetadata extends ExchangeRateQuote {
  originalPayableAmount: number;
  convertedPayableAmount: number;
}

export interface PreparedCurrencyInvoice {
  invoice: InvoiceData;
  conversion: CurrencyConversionMetadata;
}
```

The result contains a new normalized invoice. The source object is not mutated. `normalizeCurrencyCode()` trims and uppercases a code. `validateExchangeRateQuote()` applies the package pair, date, provenance, HTTPS source URL, and rate validations and returns a normalized quote.

## 6. BCV Rate Type, Units, Publication Date, Weekend, Staleness, Timeout, And Current-Page Limitation

`BcvExchangeRateProvider` is the fiscal default. It reads the official BCV dated print view and identifies the publication heading and rate table. Despite the `_expType=PDF` query parameter, the current response is textual HTML.

```ts
import { BcvExchangeRateProvider, createEfatura } from '@akira-io/efatura';

const provider = new BcvExchangeRateProvider({
  timeoutMs: 10_000,
  maxResponseBytes: 1024 * 1024,
  allowPreviousPublication: true,
  maxPublicationAgeDays: 3,
});

const efatura = createEfatura(config, { exchangeRateProvider: provider });
```

| Option | Default | Behaviour |
|---|---:|---|
| `fetcher` | global `fetch` | HTTP implementation used for the official page |
| `clock` | `SystemClock` | Supplies `retrievedAt` |
| `sourceUrl` | official BCV print URL | Must use HTTPS |
| `timeoutMs` | `10000` | Aborts a slow request |
| `maxResponseBytes` | `1048576` | Rejects a response above 1 MiB |
| `allowPreviousPublication` | `false` | Permits an earlier publication only when enabled |
| `maxPublicationAgeDays` | `0` | Maximum UTC calendar-day age of an earlier publication |

The provider defaults to the BCV buy column. Set `rateType: 'sell'` in preparation options when the sell column is required and available. `reference` and `custom` are rejected for BCV.

BCV can publish a row for more than one source-currency unit. The parser divides the published CVE value by the unit count. A row of `11,026.50 CVE` for `100 EUR` becomes `110.265 CVE` for one EUR. Missing currencies, malformed tables, non-positive units, non-positive rates, absent publication dates, HTTP failures, oversized responses, and timeouts fail closed.

By default, the publication date must equal the requested UTC calendar date. For a weekend or public holiday, enable `allowPreviousPublication` and set a positive `maxPublicationAgeDays`. The provider records the actual earlier publication date and rejects future or older publications. Setting `allowPreviousPublication: true` while leaving the maximum age at `0` does not permit an earlier date.

The BCV print page is current and dynamic. It is not a documented historical-rate API. Changing `effectiveAt` does not make that page return an archived publication. An earlier request fails unless `sourceUrl` points to a separately configured, trusted historical source with the same expected page shape. For audited historical rates, prefer `FixedExchangeRateProvider` or a trusted `CallbackExchangeRateProvider`.

The package never switches to World Bank, a cached value, a prior day, or another provider after a BCV failure. Any fallback policy must be explicit in application code and must preserve the provenance of the rate that was applied.

## 7. World Bank Annual-Reference Limitation And Economy Mapping

`WorldBankExchangeRateProvider` is optional and must be injected explicitly. Its default indicator, `PA.NUS.FCRF`, is an annual official exchange-rate observation. It can support reporting, analytics, imports, and application-defined reference policies. It is not a BCV daily fiscal quote and is never the fiscal default.

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

The API is organized by economy, not currency. The built-in mapping contains `CVE: 'CPV'`, and USD is treated as one USD per USD without a lookup. Every other currency needs an explicit unambiguous `economyByCurrency` entry. Consumer entries are normalized and merged with the CVE mapping.

| Option | Default | Behaviour |
|---|---:|---|
| `fetcher` | global `fetch` | HTTP implementation used for World Bank requests |
| `clock` | `SystemClock` | Supplies `retrievedAt` |
| `economyByCurrency` | `{ CVE: 'CPV' }` | Adds currency-to-economy mappings |
| `indicator` | `PA.NUS.FCRF` | Indicator used for both cross-rate legs |
| `baseUrl` | `https://api.worldbank.org` | HTTPS API base URL |
| `timeoutMs` | `10000` | Aborts slow requests |
| `maxResponseBytes` | `1048576` | Rejects a response above 1 MiB |

The provider reads source and target observations for the same requested UTC year, calculates the normalized multiplier, rounds it to five fractional digits, and returns `rateType: 'reference'`. `effectiveAt` is January 1 of the observation year, `retrievedAt` is the fetch time, and `sourceUrl` identifies the official indicator page. Missing mappings, missing observations, mismatched periods, invalid responses, and non-reference rate requests fail.

## 8. Fixed User Rate

Use `FixedExchangeRateProvider` when an audited rate is approved outside the package or when deterministic execution is required.

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
```

Constructor fields:

| Field | Required | Default |
|---|---|---|
| `sourceCurrency` | yes | none |
| `targetCurrency` | yes | none |
| `rate` | yes | none; must normalize to a positive value |
| `effectiveAt` | yes | none |
| `retrievedAt` | no | `effectiveAt` |
| `rateType` | no | `custom` |
| `provider` | yes | none; must contain non-whitespace text |
| `sourceUrl` | no | omitted; when present, must use HTTPS |

The provider accepts only the configured pair, rate type when requested, and an effective date on or after the quote date. It does not invent provenance. The application is responsible for approving and storing the source evidence.

The complete tested example is [EUR To CVE With A Fixed Rate](examples/currency/eur-to-cve.md).

## 9. Callback Provider

`CallbackExchangeRateProvider` adapts an application-owned service to `ExchangeRateProvider`.

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
    provider: 'Application treasury service',
    sourceUrl: rate.auditUrl,
  };
});

const efatura = createEfatura(config, { exchangeRateProvider: provider });
```

The callback type is:

```ts
export type ExchangeRateCallback = (
  request: ExchangeRateRequest,
) => Promise<ExchangeRateQuote>;
```

Callback results pass through the same quote validator as built-in providers. A callback cannot bypass pair, rate type, date, positive-rate, provider, or HTTPS source URL requirements. An `ExchangeRateError` from the callback keeps its original code. Another thrown value becomes `exchange_rate.provider_unavailable` with the original value as its cause.

An application may implement an explicit provider sequence inside its callback. The returned `provider`, `effectiveAt`, `retrievedAt`, and `sourceUrl` must describe the quote that was used, not the provider that failed first.

## 10. Monetary-Field Conversion Matrix

Every non-null first-class monetary amount is multiplied by the same normalized quote and rounded independently. Null values remain null.

| Location | Converted fields |
|---|---|
| `lines[]` | `price`, `priceExtension`, `netTotal` |
| `lines[].discount` | `value` when `valueType` is `A` or absent |
| `lines[].taxes[]` | `taxAmount`, `taxTotal` |
| `totals` | `priceExtensionTotalAmount`, `chargeTotalAmount`, `discountTotalAmount`, `netTotalAmount`, `taxTotalAmount`, `withholdingTaxTotalAmount`, `payableRoundingAmount`, `payableAmount` |
| `totals.discount` | `value` when `valueType` is `A` or absent |
| `references[]` | `paymentAmount` |
| `references[].tax` | `taxAmount`, `taxTotal` |
| `payments.payments[]` | `paymentAmount` |

The converter does not change:

- quantities or package quantities;
- tax percentages;
- percentage discounts with `valueType: 'P'`;
- dates, times, identifiers, descriptions, or codes;
- numeric or non-numeric `extraFields`;
- arbitrary numbers whose fiscal meaning is unknown.

The original source object remains unchanged. The converted invoice is validated again against the package fiscal rules before it is returned.

## 11. Precision And Rounding

Quote validation uses decimal arithmetic to round the provider rate to at most five fractional digits with half-up rounding. The active embedded XSD defines `ExchangeRate` as `stDecimal5MinExc0`, so the serialized rate must be positive and have no more than five fractional digits.

Every fiscal monetary amount is multiplied with decimal arithmetic and rounded independently to two fractional digits with half-up rounding. `payableRoundingAmount` remains signed. The converter does not derive a line from an already rounded total and does not change an arbitrary line to force reconciliation.

```text
original payable amount: 200.00 EUR
normalized quote:         110.265 CVE per EUR
exact multiplication:    22053.00000 CVE
fiscal payable amount:    22053.00 CVE
alternative amount:      200.00 EUR
XML exchange rate:        110.265
```

Independent rounding can expose a mismatch between converted lines, taxes, and totals. In that case preparation throws `exchange_rate.invoice_invalid` with the underlying validation error as its cause. Correct the source invoice or the conversion policy; do not patch the converted projection after preparation.

The embedded `Read Me.txt` records an earlier three-decimal revision. The active XSD type in `common/CV_EFatura_Types_v1.0.xsd` permits five fractional digits, and generated XML is validated against that active schema.

## 12. Existing Alternative Amounts

Automatic foreign-currency preparation rejects an invoice whose totals already contain any `payableAlternativeAmounts`. It cannot establish the provenance, direction, date, or compatibility of those existing values. The error code is `exchange_rate.alternatives_conflict`.

The low-level `InvoiceData` and XML APIs continue to accept caller-supplied alternative amounts for applications that manage those values independently. Do not pass such an invoice to `prepareInvoiceToCve()`.

For a CVE identity preparation, the provider is not called and no CVE alternative amount is created. Existing low-level alternative amounts are preserved by normal invoice validation because no foreign conversion runs.

## 13. Error Codes And Recovery Decisions

`ExchangeRateError` extends `EfaturaError`, exposes a stable `code`, and accepts an optional `cause` through its constructor options.

| Code | Condition | Recovery decision |
|---|---|---|
| `exchange_rate.provider_unavailable` | Network, timeout, HTTP, or callback failure | Retry under an application policy or stop issuance. Do not substitute another source silently. |
| `exchange_rate.response_invalid` | Upstream content or quote shape cannot be parsed safely | Stop and investigate provider or parser changes. |
| `exchange_rate.currency_unsupported` | Provider lacks the requested currency or economy mapping | Configure a supported mapping, fixed quote, or callback. |
| `exchange_rate.pair_mismatch` | Returned pair or rate type differs from the request | Correct provider configuration or callback normalization. |
| `exchange_rate.rate_invalid` | Rate is non-finite, non-positive, or rounds to zero | Reject the quote and obtain approved evidence. |
| `exchange_rate.date_unavailable` | No quote satisfies the requested date | Configure an explicit prior-publication policy or audited historical source. |
| `exchange_rate.date_invalid` | Requested or returned date is invalid or a BCV publication is in the future | Correct the date source before issuance. |
| `exchange_rate.stale` | BCV publication exceeds `maxPublicationAgeDays` | Obtain a newer publication or change policy through an approved configuration change. |
| `exchange_rate.source_required` | A configured source URL is empty, invalid, or not HTTPS | Supply a trusted HTTPS URL or omit the optional URL where supported. |
| `exchange_rate.invoice_invalid` | The converted invoice fails fiscal validation | Inspect the cause and correct the source invoice or conversion inputs. |
| `exchange_rate.alternatives_conflict` | Existing alternative amounts cannot be merged safely | Remove them before automatic preparation or use the low-level API. |

```ts
import { ExchangeRateError } from '@akira-io/efatura';

try {
  await efatura.prepareInvoiceToCve(invoiceInEur, { sourceCurrency: 'EUR' });
} catch (error) {
  if (error instanceof ExchangeRateError) {
    auditLogger.warn({ code: error.code }, error.message);
  }

  throw error;
}
```

Error messages omit credentials and complete upstream response bodies. Logs may contain the code, provider, pair, and dates when the application has those fields.

## 14. Audit Persistence And DFA Reprints

Persist both members of `PreparedCurrencyInvoice` beside the invoice or submission record:

- `invoice`, containing the normalized CVE values and canonical alternative payable amount;
- `conversion`, containing the pair, normalized rate, rate type, effective date, retrieval date, provider, optional source URL, original payable amount, and converted payable amount.

Dates are `Date` objects at runtime. When JSON storage converts them to strings, reconstruct them before passing metadata to a renderer:

```ts
const conversion = {
  ...stored.conversion,
  effectiveAt: new Date(stored.conversion.effectiveAt),
  retrievedAt: new Date(stored.conversion.retrievedAt),
};

const dfa = await efatura.renderDfa({
  iud: stored.iud,
  invoice: stored.invoice,
  conversion,
});
```

A reprint must use the stored converted invoice and stored conversion metadata. It must not call `prepareInvoiceToCve()` again, fetch a new quote, replace `retrievedAt`, or recalculate CVE values. Provider caches are optional infrastructure concerns; a cache hit must retain the original retrieval time and remain within the configured date policy. Provider failures are not cached by the package.

The default DFA displays the fiscal payable amount in CVE plus the original amount, source currency, normalized direction, effective date, provider, and optional source URL. Custom renderers receive the same `conversion` value through `DfaRenderInput`.

## 15. Security And Adapter Boundary

Built-in providers require HTTPS, limit response size, apply timeouts, and parse upstream content as untrusted input. Logs must not contain credentials or full provider responses. Callback authentication and secret handling remain application responsibilities.

Currency preparation is a trusted facade API in this release. The Express, Fastify, and Nest request schemas do not expose a generic conversion route and do not accept client-supplied provider names, source URLs, rates, or callback code as fiscal provenance. Server code selects and configures the provider.

If an application adds its own authenticated endpoint, accept only policy-approved inputs such as source currency, effective date, and allowed rate type. The server must choose the provider and return metadata produced by the trusted preparation result. Apply authentication, authorization, throttling, and timeout controls at the host boundary.

The package performs no silent fallback. Applications that implement an explicit fallback inside a callback must return evidence for the selected quote.

## 16. Migration From `renderDfa({ currency })`

`RenderDfaOptions.currency` is deprecated. It changed a display label without proving that invoice values had been converted, which could misrepresent foreign values as fiscal amounts.

Old code:

```ts
await efatura.renderDfa({
  iud,
  invoice: invoiceInEur,
  currency: 'EUR',
});
```

Migrated code:

```ts
const prepared = await efatura.prepareInvoiceToCve(invoiceInEur, {
  sourceCurrency: 'EUR',
});

await efatura.renderDfa({
  iud,
  invoice: prepared.invoice,
  conversion: prepared.conversion,
});
```

When `invoice` is supplied, the renderer always receives `currency: 'CVE'`; remove the legacy option. For IUD-only rendering, `currency: 'CVE'` remains accepted during the compatibility period, while a foreign value throws `EfaturaValidationError` with code `dfa.currency_invalid`. The package does not emit a deprecation warning at runtime. TypeScript users receive the `@deprecated` annotation from `RenderDfaOptions`.

Migration is complete when the application prepares foreign invoices before XML or DFA creation, persists the result, removes foreign DFA labels, and reuses stored conversion evidence for every reprint.
