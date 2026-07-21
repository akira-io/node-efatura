# Configuration

`createEfatura(config)` accepts a config object and optional dependency implementations.

| Key | Description |
|-----|-------------|
| `transmitterNif` | Issuer tax identifier |
| `transmitterLed` | Numeric issuer LED code assigned by DNRE, up to 5 digits |
| `transmitterKey` | Middleware credential or shared key |
| `defaultSerie` | Default document series when an invoice does not set `serie` |
| `emitter` | Default issuer party used when a document does not pass `.emitter(...)` |
| `softwareCode` | Registered software code. The official XSD accepts uppercase letters and digits |
| `softwareName` | Software name sent to middleware |
| `softwareVersion` | Software version sent to middleware |
| `middlewareBaseUrl` | Local middleware base URL |
| `platformBaseUrl` | PE services base URL. Defaults to `https://services.efatura.cv` |
| `dfaBaseUrl` | DFA QR Code base URL. Defaults to `https://pe.efatura.cv/dfe/view` |
| `environment` | `PRODUCTION`, `HOMOLOGATION`, `TEST`, or repository code `1`, `2`, `3` |

Empty `environment` values resolve to `TEST`.

## Default Emitter

Use `config.emitter` for the taxpayer that usually issues documents through this Efatura instance. Its `taxId.value` defaults to `transmitterNif`, so the invoice builder does not need `.emitter(...)` for the normal case.

```ts
const efatura = createEfatura({
  transmitterNif: '100200300',
  transmitterLed: '123',
  defaultSerie: 'SER-F',
  emitter: {
    name: 'Emitter',
    address: {
      countryCode: 'CV',
      addressDetail: 'Emitter address',
    },
    contacts: {
      email: 'issuer@example.cv',
      telephone: '5551234',
    },
  },
  softwareCode: 'SW001',
  softwareName: 'Efatura Suite',
  softwareVersion: '1.0.0',
  middlewareBaseUrl: 'https://localhost:3443',
});
```

Call `.emitter(...)` on a document only when this Efatura instance is issuing for another taxpayer. The document emitter overrides `config.emitter`.

## Dependencies

The second argument composes official or storage-backed dependencies without coupling the core to specific libraries.

```ts
const efatura = createEfatura(config, {
  certificateValidator,
  sequenceStore,
  xsdValidator,
  xmlSigner,
  middlewareTransport,
  platformTransport,
  goldenVectors,
  taxpayerRegistryClient,
  softwareRegistryClient,
  emitterAuthorizationClient,
  exchangeRateProvider,
});
```

Defaults are concrete infrastructure implementations: OpenSSL-backed certificate validation, in-memory sequence storage, bundled XSD validation through `xmllint`, XAdES-BES signing, DFA PDF rendering, fetch-based transports, fiscal authority fetch clients, in-memory golden vectors, and BCV exchange rates.

Override `sequenceStore` for durable numbering. `FileSequenceStore` ships in the root entry; database-backed stores live at `@akira-io/efatura/knex` and `@akira-io/efatura/prisma` so ORM dependencies stay optional. See [Storage](09-storage.md).

Fiscal authority clients are used by `validateFiscalReadiness(invoice, options)`. External PE and DNRE checks require `options.accessToken`; without it, those checks return `skipped` so offline validation remains deterministic.

Live fiscal readiness tests are opt-in. Set `EFATURA_LIVE_TESTS=1` with `EFATURA_LIVE_ACCESS_TOKEN`, `EFATURA_LIVE_BASE_URL`, `EFATURA_LIVE_TRANSMITTER_NIF`, `EFATURA_LIVE_EMITTER_NIF`, `EFATURA_LIVE_RECEIVER_NIF`, `EFATURA_LIVE_SOFTWARE_CODE`, `EFATURA_LIVE_SOFTWARE_NAME`, and `EFATURA_LIVE_SOFTWARE_VERSION`.

Use `FileSystemGoldenVectorRepository` when DNRE-provided vectors are stored on disk:

```ts
import { FileSystemGoldenVectorRepository } from '@akira-io/efatura';

const efatura = createEfatura(config, {
  goldenVectors: new FileSystemGoldenVectorRepository('resources/golden-vectors'),
});
```

The expected layout is `resources/golden-vectors/{kind}/{name}.{extension}`, where `kind` is `iud`, `xml`, `zip`, or `signature`. Optional metadata can live next to a vector as `{name}.meta.json`.

## Exchange-Rate Provider

`EfaturaDependencies.exchangeRateProvider` accepts any `ExchangeRateProvider`. When omitted, `createEfatura()` constructs `BcvExchangeRateProvider` with the global `fetch` implementation and the resolved facade clock. The BCV provider defaults to a buy quote, a 10-second timeout, a 1 MiB response limit, strict publication-date matching, and no previous-publication allowance.

```ts
import { BcvExchangeRateProvider, createEfatura } from '@akira-io/efatura';

const exchangeRateProvider = new BcvExchangeRateProvider({
  timeoutMs: 10_000,
  maxResponseBytes: 1024 * 1024,
  allowPreviousPublication: true,
  maxPublicationAgeDays: 3,
});

const efatura = createEfatura(config, { exchangeRateProvider });
```

Set both `allowPreviousPublication` and a positive `maxPublicationAgeDays` to permit an earlier BCV publication for a weekend or public holiday. The current BCV print page is dynamic and is not a documented historical API.

Provider-specific options:

| Provider | Options and defaults |
|---|---|
| `BcvExchangeRateProvider` | `fetcher`: global `fetch`; `clock`: `SystemClock`; `sourceUrl`: official print page; `timeoutMs`: `10000`; `maxResponseBytes`: `1048576`; `allowPreviousPublication`: `false`; `maxPublicationAgeDays`: `0` |
| `WorldBankExchangeRateProvider` | `fetcher`: global `fetch`; `clock`: `SystemClock`; `economyByCurrency`: `{ CVE: 'CPV' }`; `indicator`: `PA.NUS.FCRF`; `baseUrl`: `https://api.worldbank.org`; `timeoutMs`: `10000`; `maxResponseBytes`: `1048576` |
| `FixedExchangeRateProvider` | Required pair, rate, effective date, and provider name; `retrievedAt` defaults to `effectiveAt`; `rateType` defaults to `custom`; `sourceUrl` is optional |
| `CallbackExchangeRateProvider` | Requires one asynchronous `ExchangeRateCallback` |

World Bank data is an annual reference and is never selected automatically. No provider failure triggers a silent fallback. See [Currency Conversion](18-currency-conversion.md) for contracts, date policy, rate direction, and audit requirements.

## UUID Generators

Document, submission, and batch identifiers use UUIDs by default.

```ts
const efatura = createEfatura({
  transmitterNif: '100200300',
  transmitterLed: '123',
  softwareCode: 'SW001',
  softwareName: 'Efatura Suite',
  softwareVersion: '1.0.0',
  middlewareBaseUrl: 'https://localhost:3443',
  platformBaseUrl: 'https://services.efatura.cv',
  dfaBaseUrl: 'https://pe.efatura.cv/dfe/view',
  generators: {
    documentId: () => crypto.randomUUID(),
  },
});
```
