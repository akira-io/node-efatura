# Architecture

`@akira-io/efatura` follows the same clean boundary used by `node-sisp` and `payable`: a framework-agnostic facade, a contracts-only core, domain value objects, application use cases, infrastructure implementations, and presentation adapters.

```text
src/
  core/                 Contracts only. No Zod, no HTTP, no filesystem, no framework imports.
  domain/               Fiscal enums, value objects, policies, IUD logic, and domain errors.
  application/          Builders, XML v11 generation, DFA helpers, packaging, and use-case validation.
  infrastructure/       Default clocks, sequence stores, transports, PDF renderer, XSD and signer placeholders.
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

The `core` folder is intentionally small. It defines contracts such as `XsdValidator`, `XmlSigner`, `SequenceStore`, `DfaRenderer`, `MiddlewareTransport`, and `PlatformTransport`.

## Official Artifacts

The official XSD files, certificate-backed XAdES-BES signing implementation, and official golden vectors are not embedded in the package. The package exposes contracts for them and fails explicitly when a required official artifact has not been injected.

## XML v11

XML generation is documented in [XML v11](05-xml-v11.md). The important structural rule is that `Dfe` wraps a document-specific first child such as `Invoice`, `SalesReceipt`, `CreditNote`, or `Transport`.

## Packaging

ZIP packaging is documented in [Packaging](07-packaging.md). The implementation is in `src/application/packaging` and remains transport-agnostic.

## Validation

Zod validation is documented in [Validation And Zod](06-validation-zod.md). Zod is used in `domain` and `presentation`, while `core` remains contracts-only.
