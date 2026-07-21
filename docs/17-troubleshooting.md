# Troubleshooting

Use this guide when local validation, framework adapters, Prisma setup, signing, or PDF rendering fails.

## Prisma Model Was Not Found

Run the copy command:

```sh
npx @akira-io/efatura prisma
```

Then run your migration:

```sh
npx prisma migrate dev
```

or:

```sh
npx prisma db push
```

If your project uses a single `schema.prisma`, print only the model blocks and append them manually:

```sh
npx @akira-io/efatura prisma --models-only --print
```

Use `--force` only when replacing the generated e-Fatura fragment is intentional.

## Prisma 7 Driver Adapter Error

Prisma 7 and newer require a driver adapter when constructing `PrismaClient`. Configure the adapter in your app, regenerate the client, then pass `prisma.efaturaSequence` to `PrismaSequenceStore`.

## `prisma db push` Fails On A Known Schema

Check that the e-Fatura model fragment is in the schema folder Prisma reads. In multi-file schemas, the default target is:

```text
prisma/schema/efatura-sequence.prisma
```

In single-file schemas, append the model to the file referenced by your Prisma config.

## `xmllint` Is Missing

`XmllintXsdValidator` shells out to `xmllint`. Install libxml2 tools for your operating system or inject another `XsdValidator`.

If no validator is configured, XSD validation reports that the official validator is unavailable.

## Certificate Or Private Key Fails Validation

Run:

```ts
await efatura.validateCertificate({
  certificate,
  privateKey,
  caCertificates,
});
```

Common causes:

- private key does not match the certificate;
- PEM content was escaped incorrectly in the environment;
- certificate chain is missing;
- OpenSSL is not available in the runtime image.

## Signing Fails

`signDfeXml()` and `signEventXml()` require certificate and private key material for the default signer.

Check:

- certificate and private key are loaded on the server;
- XML was built before signing;
- the document has the expected `Id`;
- the signing time is valid when supplied.

## Adapter Returns 401

The package adapters call the authorization hook before executing fiscal operations. Check the app session, bearer token, or guard that wraps the adapter route.

Do not remove the authorization hook to fix local tests. Browser clients must not reach fiscal routes without application authorization.

## Adapter Returns 404 For `/dfa`

Confirm that the installed package version includes the DFA route and that the server was restarted after dependency changes.

For Fastify, the route is mounted under the plugin prefix. If the prefix is `/efatura`, the full route is:

```text
POST /efatura/dfa
```

If the app is using a local tarball, reinstall it after rebuilding the package.

## CORS Fails From A SPA

Register CORS on the application server before mounting the adapter and allow the SPA origin:

```ts
await app.register(cors, {
  origin: 'http://localhost:5173',
  credentials: true,
});
```

The browser request must also set `credentials: 'include'` when authorization depends on cookies.

## Fiscal Readiness Is Skipped

External PE and DNRE checks require `options.accessToken`.

```ts
await efatura.validateFiscalReadiness(invoice, {
  accessToken,
});
```

Without a token, the result can still pass local validation, but external checks are reported as `skipped`.

## DFA PDF Has Missing Details

Pass the invoice to `renderDfa()` or `POST /dfa`:

```ts
await efatura.renderDfa({ iud, invoice });
```

IUD-only rendering can create a PDF, but it cannot include parties, lines, tax totals, or invoice issue details that are not present in the IUD.

## BCV Quote Is Unavailable

`exchange_rate.provider_unavailable` covers network, timeout, and HTTP failures. `exchange_rate.response_invalid` means the current page no longer matches the expected publication heading or table shape. Check network access, the configured HTTPS source, timeout, response limit, and BCV page format.

The package does not switch to World Bank or another provider. World Bank is an annual reference source, not a fiscal daily fallback. Stop issuance or apply an explicit application policy with accurate provenance.

## BCV Date Is Unavailable Or Stale

The current BCV print page is dynamic and is not a documented historical API. Strict matching is the default, so an earlier page publication produces `exchange_rate.date_unavailable`.

For a weekend or public holiday, configure both fields:

```ts
new BcvExchangeRateProvider({
  allowPreviousPublication: true,
  maxPublicationAgeDays: 3,
});
```

`exchange_rate.stale` means the earlier publication exceeds the configured maximum age. `exchange_rate.date_invalid` can mean the request date is invalid or the page returned a future publication. Use a fixed or callback provider for an approved historical quote when the current page cannot satisfy the date.

## Exchange-Rate Pair Or Currency Does Not Match

`exchange_rate.currency_unsupported` means the input is not in the Node.js 20 ISO 4217 currency list or the selected provider lacks a required mapping. Invalid codes fail before the provider is called. `exchange_rate.pair_mismatch` means the quote pair or rate type differs from the request. Confirm that the source code is supported, the target is CVE, BCV uses buy or sell, and World Bank uses reference.

Rates follow `amountInTarget = amountInSource * rate`. A EUR to CVE rate must express CVE per EUR, not EUR per CVE.

## Exchange-Rate Precision Fails

`exchange_rate.rate_invalid` means the rate is non-finite, non-positive, or rounds to zero at five fractional digits. The active XSD limits `ExchangeRate` to five fractional digits. Supply a positive source-to-CVE multiplier and let the package normalize it.

`exchange_rate.invoice_invalid` means independently rounded CVE fields no longer pass fiscal consistency validation. Inspect the error cause and correct the source values. Do not alter one converted line to force totals to match.

## Alternative Amounts Conflict

`exchange_rate.alternatives_conflict` means the source invoice already contains `payableAlternativeAmounts`. Automatic preparation cannot verify those values. Remove them before preparation or manage them through the low-level invoice and XML APIs without calling `prepareInvoiceToCve()`.

## DFA Conversion Evidence Is Missing

Pass both fields from the stored preparation result:

```ts
await efatura.renderDfa({
  iud,
  invoice: prepared.invoice,
  conversion: prepared.conversion,
});
```

Do not use the deprecated `currency` field to label an unconverted invoice. A foreign label in IUD-only rendering throws `dfa.currency_invalid`. Reprints must reconstruct stored date strings as `Date` objects and reuse the original converted invoice and metadata instead of obtaining a new quote.

## Runtime Uses The Wrong Node Version

The package requires Node 20 or newer. Check:

```sh
node --version
```

If a local package manager or shell integration selects an older runtime, switch to Node 20 or newer and reinstall dependencies.
