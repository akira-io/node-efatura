# Architecture

`@akira-io/efatura` follows the same clean boundary used by `node-sisp` and `payable`: a framework-agnostic facade, a contracts-only core, domain value objects, application use cases, infrastructure implementations, and presentation adapters.

```text
src/
  core/                 Contracts only, including ExchangeRateProvider.
  domain/               Fiscal enums, value objects, policies, IUD logic, and currency errors.
  application/          Builders, currency preparation, XML, DFA helpers, packaging, and validation.
  infrastructure/       BCV, World Bank, fixed, and callback providers plus other adapters.
  presentation/         Express, Fastify, Nest, and shared HTTP request schemas.
  support/              Internal messages, normalizers, and UUID helpers.
  config.ts             Config resolution and defaults.
  create-efatura.ts     Composition entry point.
  efatura.ts            Public facade.
```

## Dependency Direction

Dependencies point inward:

```text
presentation -> application -> domain -> core contracts
infrastructure -> core contracts and application contracts
```

The `core` folder is intentionally small. It defines contracts such as `XsdValidator`, `XmlSigner`, `CertificateValidator`, `SequenceStore`, `DfaRenderer`, `MiddlewareTransport`, `PlatformTransport`, fiscal authority registry clients, and `GoldenVectorRepository`.

## Currency Boundary

Currency conversion keeps policy and external access separate:

```text
src/core/contracts/exchange-rate-provider.ts
  defines ExchangeRateProvider, request, quote, and metadata

src/domain/currency/
  validates quote direction, dates, precision, and error codes

src/application/currency/
  prepares one CVE projection and converts known monetary fields

src/infrastructure/currency/
  integrates BCV, World Bank, fixed quotes, and application callbacks
```

The application use case depends on `ExchangeRateProvider`, not on BCV or World Bank. Infrastructure normalizes upstream units and annual or daily source shapes into one source-to-target multiplier. `buildDfeXml()` and `renderDfa()` do not fetch rates.

Presentation adapters do not accept conversion provenance in HTTP payloads in this release. Trusted server code calls `prepareInvoiceToCve()` through the facade, persists the returned invoice and metadata, and supplies them to XML and DFA operations. This prevents a client from claiming that a submitted rate or URL came from BCV.

## Official Artifacts

The official e-Fatura XSD files supplied to the project are embedded under `resources/xsd/efatura/2024-05-27`. The package also includes concrete `XmllintXsdValidator`, `XadesBesSigner`, `OpensslCertificateValidator`, fiscal authority fetch clients, and `FileSystemGoldenVectorRepository` implementations. Official golden vectors for IUD, ZIP, and signatures were not published with the supplied artifacts. Internal fixtures under `resources/golden-vectors/internal` are package baselines, not DNRE vectors.

## XML v11

XML generation is documented in [XML v11](05-xml-v11.md). The important structural rule is that `Dfe` wraps a document-specific first child such as `Invoice`, `SalesReceipt`, `CreditNote`, or `Transport`.

## Packaging

ZIP packaging is documented in [Packaging](07-packaging.md). The implementation is in `src/application/packaging` and remains transport-agnostic.

## Validation

Zod validation is documented in [Validation And Zod](06-validation-zod.md). Zod is used in `domain` and `presentation`, while `core` remains contracts-only.

## Compliance

Coverage against the official manual and XML-XSD artifacts is tracked in [Compliance Matrix](11-compliance-matrix.md).
