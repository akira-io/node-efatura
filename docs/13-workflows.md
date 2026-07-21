# Workflows

This guide shows the package-level flows used by production integrations. The examples assume `efatura` was created with `createEfatura(config, dependencies)`.

## Build And Validate An Invoice

```ts
const invoice = efatura.validateInvoice(rawInvoice);
```

The invoice parser normalizes values, applies document-type compatibility rules, applies local fiscal rules, and returns `InvoiceData`. Invalid data throws `EfaturaValidationError`.

Use the builder when the app creates documents directly:

```ts
const invoice = efatura
  .invoice()
  .type('FTE')
  .issueDate('2026-02-08')
  .receiver({ taxId: { countryCode: 'CV', value: '900800700' }, name: 'Receiver' })
  .lines(lines)
  .totals(totals)
  .validate();
```

## Allocate A Fiscal Number

```ts
const documentNumber = await efatura.nextDocumentNumber(invoice.issueDate, invoice.type);
```

The number is scoped by transmitter NIF, year, LED code, and document type. Configure a durable sequence store before using this in production.

If the application does not need to inspect the number first, build the IUD directly:

```ts
const iud = await efatura.buildSequentialIud({
  issueDate: invoice.issueDate,
  documentType: invoice.type,
  randomCode: '1234567890',
});
```

## Prepare A Foreign-Currency Invoice

Prepare foreign application values before allocating downstream artifacts:

```ts
const prepared = await efatura.prepareInvoiceToCve(invoiceInEur, {
  sourceCurrency: 'EUR',
});

const invoice = prepared.invoice;
```

The returned invoice contains CVE fiscal amounts and one alternative payable amount for the original EUR payable value. Use this `invoice` for IUD context, XML, XSD validation, DFA, signing, packaging, and submission. Pass `prepared.conversion` to DFA rendering.

Persist both result fields with the fiscal record. A retry or DFA reprint must reuse them and must not obtain a new quote. BCV is the default provider. World Bank is an explicitly configured annual reference source and is not a daily fiscal fallback.

## Build XML

```ts
const xml = efatura.buildDfeXml(invoice, {
  documentNumber,
  randomCode: '1234567890',
});
```

`buildDfeXml()` validates issue-date tolerance and contingency consistency before building XML.

Use `iud` instead of `documentNumber` when the fiscal number was generated elsewhere:

```ts
const xml = efatura.buildDfeXml(invoice, { iud });
```

## Validate XML Against XSD

```ts
const result = await efatura.validateDfeXml(xml, invoice.type);

if (!result.valid) {
  throw new Error(result.errors.map((error) => error.message).join('\n'));
}
```

Configure `XmllintXsdValidator` or another `XsdValidator` implementation before relying on this check.

## Sign XML

```ts
const signed = await efatura.signDfeXml(xml, {
  certificate,
  privateKey,
});
```

The default signer produces XAdES-BES signatures and returns signed XML plus signature metadata.

## Package ZIP

```ts
const zip = efatura.buildDfeZip([{ iud, xml: signed.xml }]);
```

Each file is written as `{IUD}.xml` using Deflate compression.

## Submit Through Middleware

```ts
const result = await efatura.submitDfeZip(zip);
```

This uses `middlewareBaseUrl` and `transmitterKey` from config. The response is normalized into request metadata, document-level results, and errors when the service returns structured payloads.

## Submit Through Platform

```ts
const result = await efatura.submitDfeZipToPlatform(zip, {
  accessToken,
});
```

This uses `platformBaseUrl` from config unless `baseUrl` is supplied in options. Use this path only where the app owns PE token handling.

## Render DFA

```ts
const dfa = await efatura.renderDfa({
  iud,
  invoice,
});
```

When `invoice` is supplied, the renderer receives parties, issue data, line summaries, taxes, totals, QR code URL, and contingency data. When only `iud` is supplied, the renderer can still create an IUD-only document.

For a prepared foreign-currency invoice, include conversion evidence:

```ts
const dfa = await efatura.renderDfa({
  iud,
  invoice: prepared.invoice,
  conversion: prepared.conversion,
});
```

The primary DFA amounts remain CVE. The evidence section identifies the original amount, normalized rate direction, effective date, provider, and optional source URL.

## HTTP Adapter Flow For SPAs

Browser clients should call an authenticated application server. They must not receive transmitter keys, certificates, private keys, PE tokens, or DNRE credentials.

Currency preparation is facade-only in this release. The package HTTP schemas do not accept client-supplied rates, provider names, source URLs, or conversion metadata. Trusted server code selects the provider and prepares the invoice before calling adapter-independent fiscal operations.

Typical SPA flow:

1. POST `/efatura/dfe/xml` with `{ invoice, options }`.
2. POST `/efatura/dfe/validate/fiscal-readiness` when the user needs readiness feedback.
3. POST `/efatura/dfa` with `{ iud, invoice, options }` to preview the PDF.
4. POST `/efatura/dfe/zip` after XML is approved for packaging.
5. Submit from the server side only.

See [Fastify Server Example](examples/fastify/server.md) and the SPA examples under `docs/examples/fastify`.

## Recovery Flow

If a submission fails before the official platform accepts the document, keep the generated IUD, XML, ZIP payload, and transport response. Do not allocate a replacement number until the operational process decides that the original fiscal document number can no longer be used.

If quote retrieval fails before preparation completes, no XML or DFA should be produced. Apply an explicit application recovery policy based on `ExchangeRateError.code`. Do not switch providers or accept a stale rate silently.

See [Currency Conversion](18-currency-conversion.md) for the complete foreign-currency workflow and error decisions.
