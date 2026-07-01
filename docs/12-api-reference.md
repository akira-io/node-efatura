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
  currency: 'CVE',
});
```

| Method | Purpose |
|--------|---------|
| `dfaQrCodeUrl(iud)` | Builds the official DFA lookup URL from `dfaBaseUrl` |
| `renderDfa(options)` | Renders a PDF through the configured DFA renderer |

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
