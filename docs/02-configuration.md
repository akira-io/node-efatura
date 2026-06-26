# Configuration

`createEfatura(config)` accepts a config object and optional dependency implementations.

| Key | Description |
|-----|-------------|
| `transmitterNif` | Issuer tax identifier |
| `transmitterLed` | Issuer LED code assigned by DNRE |
| `transmitterKey` | Middleware credential or shared key |
| `softwareCode` | Software code assigned for fiscal transmission |
| `softwareName` | Software name sent to middleware |
| `softwareVersion` | Software version sent to middleware |
| `middlewareBaseUrl` | Local middleware base URL |
| `platformBaseUrl` | PE services base URL. Defaults to `https://services.efatura.cv` |
| `dfaBaseUrl` | DFA QR Code base URL. Defaults to `https://pe.efatura.cv/dfe/view` |
| `environment` | `PRODUCTION`, `HOMOLOGATION`, `TEST`, or repository code `1`, `2`, `3` |

Empty `environment` values resolve to `TEST`.

## Dependencies

The second argument composes official or storage-backed dependencies without coupling the core to specific libraries.

```ts
const efatura = createEfatura(config, {
  sequenceStore,
  xsdValidator,
  xmlSigner,
  middlewareTransport,
  platformTransport,
  goldenVectors,
});
```

## UUID Generators

Document, submission, and batch identifiers use UUIDs by default.

```ts
const efatura = createEfatura({
  transmitterNif: '100200300',
  transmitterLed: 'LED123',
  softwareCode: 'SW-001',
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
