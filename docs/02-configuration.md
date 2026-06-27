# Configuration

`createEfatura(config)` accepts a config object and optional dependency implementations.

| Key | Description |
|-----|-------------|
| `transmitterNif` | Issuer tax identifier |
| `transmitterLed` | Numeric issuer LED code assigned by DNRE, up to 5 digits |
| `transmitterKey` | Middleware credential or shared key |
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
});
```

Defaults are concrete infrastructure implementations: OpenSSL-backed certificate validation, in-memory sequence storage, bundled XSD validation through `xmllint`, XAdES-BES signing, DFA PDF rendering, fetch-based transports, and in-memory golden vectors.

Use `FileSystemGoldenVectorRepository` when DNRE-provided vectors are stored on disk:

```ts
import { FileSystemGoldenVectorRepository } from '@akira-io/efatura';

const efatura = createEfatura(config, {
  goldenVectors: new FileSystemGoldenVectorRepository('resources/golden-vectors'),
});
```

The expected layout is `resources/golden-vectors/{kind}/{name}.{extension}`, where `kind` is `iud`, `xml`, `zip`, or `signature`. Optional metadata can live next to a vector as `{name}.meta.json`.

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
