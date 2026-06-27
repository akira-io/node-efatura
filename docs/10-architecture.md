# Architecture

`@akira-io/efatura` follows the same clean boundary used by `node-sisp` and `payable`: a framework-agnostic facade, a contracts-only core, domain value objects, application use cases, infrastructure implementations, and presentation adapters.

```text
src/
  core/                 Contracts only. No Zod, no HTTP, no filesystem, no framework imports.
  domain/               Fiscal enums, value objects, policies, IUD logic, and domain errors.
  application/          Builders, XML v11 generation, DFA helpers, packaging, and use-case validation.
  infrastructure/       Default clocks, sequence stores, transports, PDF renderer, XSD validator, and signer.
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

The `core` folder is intentionally small. It defines contracts such as `XsdValidator`, `XmlSigner`, `CertificateValidator`, `SequenceStore`, `DfaRenderer`, `MiddlewareTransport`, `PlatformTransport`, and `GoldenVectorRepository`.

## Official Artifacts

The official e-Fatura XSD files supplied to the project are embedded under `resources/xsd/efatura/2024-05-27`. The package also includes concrete `XmllintXsdValidator`, `XadesBesSigner`, `OpensslCertificateValidator`, and `FileSystemGoldenVectorRepository` implementations. Official golden vectors for IUD, ZIP, and signatures were not included in the supplied artifacts, so the filesystem repository only loads externally supplied fixtures instead of generating synthetic official values.

## XML v11

XML generation is documented in [XML v11](05-xml-v11.md). The important structural rule is that `Dfe` wraps a document-specific first child such as `Invoice`, `SalesReceipt`, `CreditNote`, or `Transport`.

## Packaging

ZIP packaging is documented in [Packaging](07-packaging.md). The implementation is in `src/application/packaging` and remains transport-agnostic.

## Validation

Zod validation is documented in [Validation And Zod](06-validation-zod.md). Zod is used in `domain` and `presentation`, while `core` remains contracts-only.
