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
await efatura.renderDfa({ iud, invoice, currency: 'CVE' });
```

IUD-only rendering can create a PDF, but it cannot include parties, lines, tax totals, or invoice issue details that are not present in the IUD.

## Runtime Uses The Wrong Node Version

The package requires Node 20 or newer. Check:

```sh
node --version
```

If a local package manager or shell integration selects an older runtime, switch to Node 20 or newer and reinstall dependencies.
