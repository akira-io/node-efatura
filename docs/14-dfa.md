# DFA

DFA means Documento Fiscal Auxiliar. The package can render a PDF for local preview or application delivery through the `DfaRenderer` contract.

The default renderer is `PdfDfaRenderer`.

```ts
import { PdfDfaRenderer, createEfatura } from '@akira-io/efatura';

const efatura = createEfatura(config, {
  dfaRenderer: new PdfDfaRenderer(),
});
```

## QR Code URL

```ts
const url = efatura.dfaQrCodeUrl(iud);
```

The URL is built from `dfaBaseUrl` and the encoded IUD. The base URL must use HTTPS.

## Render From The Facade

```ts
const dfa = await efatura.renderDfa({
  iud,
  invoice,
  emissionMode: 'Online',
});
```

`renderDfa()` returns:

```ts
{
  contentType: 'application/pdf',
  filename: `${iud}.pdf`,
  buffer: Buffer
}
```

## Input Mapping

When `invoice` is supplied, the package maps these fields to the renderer:

| Renderer field | Source |
|----------------|--------|
| `documentTypeCode` | `invoice.type` |
| `series` | `invoice.serie` |
| `documentNumber` | `invoice.innerDocumentNumber` or the number parsed from the IUD |
| `issueDate` | `invoice.issueDate` |
| `issueTime` | `invoice.issueTime` |
| `issuerTaxId` | `invoice.emitter.taxId.value` |
| `issuerName` | `invoice.emitter.name` |
| `issuerAddress` | `invoice.emitter.address.addressDetail` |
| `issuerContact` | emitter email, mobile phone, or telephone |
| `customerTaxId` | `invoice.receiver.taxId.value` |
| `customerName` | `invoice.receiver.name` |
| `customerAddress` | `invoice.receiver.address.addressDetail` |
| `customerContact` | receiver email, mobile phone, or telephone |
| `lines` | invoice lines |
| `totals` | invoice totals |
| `total` | `invoice.totals.payableAmount` |
| `currency` | always `CVE` when `invoice` is supplied |
| `conversion` | `RenderDfaOptions.conversion` |

Line mapping:

| Renderer field | Source |
|----------------|--------|
| `code` | `line.item.emitterIdentification` |
| `description` | `line.item.description` |
| `quantity` | `line.quantity.value` |
| `unitCode` | `line.quantity.unitCode` |
| `unitPrice` | `line.price` |
| `netTotal` | `line.netTotal` |
| `taxTotal` | sum of `line.taxes[].taxTotal` |

## HTTP Adapter

The adapters expose two DFA routes:

| Method | Path | Payload |
|--------|------|---------|
| `POST` | `/dfa` | `{ iud, invoice?, options? }` |
| `GET` | `/dfa/:iud` | IUD-only render |

`POST /dfa` validates `invoice` before rendering when invoice data is present.

```ts
await fetch('/efatura/dfa', {
  method: 'POST',
  credentials: 'include',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    iud,
    invoice,
    options: {
      currency: 'CVE',
      title: 'Documento Fiscal Auxiliar',
    },
  }),
});
```

Supported `options`:

| Option | Purpose |
|--------|---------|
| `emissionMode` | `Online`, `Offline`, or `Off` |
| `contingencyIuc` | Contingency IUC displayed when applicable |
| `title` | PDF title override |
| `currency` | Deprecated compatibility field; only `CVE` is accepted |

The HTTP schema rejects conversion metadata. Currency preparation and provenance remain a trusted facade concern in this release. Server code can prepare and render directly through `Efatura`, or expose an application-owned authenticated endpoint with a server-selected provider.

## Currency Conversion Evidence

DFE and DFA fiscal amounts are always CVE. For a prepared foreign-currency invoice, pass the returned invoice and conversion metadata together:

```ts
const prepared = await efatura.prepareInvoiceToCve(invoiceInEur, {
  sourceCurrency: 'EUR',
});

const dfa = await efatura.renderDfa({
  iud,
  invoice: prepared.invoice,
  conversion: prepared.conversion,
});
```

The default PDF renderer shows:

- the original payable amount and source currency;
- the rate as `1 {sourceCurrency} = {rate} CVE` with up to five fractional digits;
- the quote effective date;
- the provider name;
- the source URL when present.

Conversion evidence paginates when it does not fit below the totals. Persist `prepared.invoice` and `prepared.conversion`, and use the stored values for reprints. Fetching a second quote could make the DFA disagree with the signed DFE.

## Deprecated Currency Label

`RenderDfaOptions.currency` is deprecated. It relabeled values without converting them and could produce a misleading fiscal document.

When `invoice` is present, renderer input is fixed to `CVE` and the legacy label is ignored. When rendering by IUD alone, `currency: 'CVE'` remains accepted during the compatibility period; another value throws `EfaturaValidationError` with code `dfa.currency_invalid`. No runtime deprecation warning is emitted.

Remove `currency` and pass the prepared invoice plus `conversion`. See [Currency Conversion](18-currency-conversion.md) for the migration flow.

## Pagination

The PDF renderer paginates item rows. The regression test covers 24 lines and asserts that the document uses more than one page instead of dropping rows.

Use a sample with more lines when testing invoice layouts manually. See [Fastify Invoice Payload](examples/fastify/invoice.md).

## Custom Renderer

Implement `DfaRenderer` when the application needs a branded layout:

```ts
import type { DfaDocument, DfaRenderInput, DfaRenderer } from '@akira-io/efatura';

class BrandedDfaRenderer implements DfaRenderer {
  async render(input: DfaRenderInput): Promise<DfaDocument> {
    return {
      contentType: 'application/pdf',
      filename: `${input.iud}.pdf`,
      buffer: await renderPdf(input),
    };
  }
}
```

`DfaRenderInput.conversion` is optional `CurrencyConversionMetadata`. When present, keep the original amount, source currency, normalized rate direction, effective date, provider, and optional source URL visible with the QR code URL, IUD, issuer, customer, line, tax, total, and contingency fields.
