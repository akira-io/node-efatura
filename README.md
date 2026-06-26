# @akira-io/efatura

[![npm version](https://img.shields.io/npm/v/@akira-io/efatura/beta.svg)](https://www.npmjs.com/package/@akira-io/efatura)
[![node](https://img.shields.io/node/v/@akira-io/efatura)](https://www.npmjs.com/package/@akira-io/efatura)
[![license](https://img.shields.io/npm/l/@akira-io/efatura.svg)](LICENSE.md)
[![status](https://img.shields.io/badge/status-beta-orange.svg)](https://www.npmjs.com/package/@akira-io/efatura)

> Beta software. Pin an exact version in production and review the changelog before upgrading.

Framework-agnostic Node.js engine for Cabo Verde e-Fatura fiscal document data. This package ports the implemented behavior from `akira/efatura`: document type policies, DNRE repository configuration, fiscal value objects, validation rules, and UUID-based local document identifiers.

## Install

```sh
bun add @akira-io/efatura
```

## Quick Start

```ts
import { DocumentType, createEfatura } from '@akira-io/efatura';

const efatura = createEfatura({
  transmitterNif: process.env.EFATURA_TRANSMITTER_NIF,
  transmitterLed: process.env.EFATURA_TRANSMITTER_LED,
  transmitterKey: process.env.EFATURA_TRANSMITTER_KEY,
  softwareCode: process.env.EFATURA_SOFTWARE_CODE,
  softwareName: process.env.EFATURA_SOFTWARE_NAME,
  softwareVersion: process.env.EFATURA_SOFTWARE_VERSION,
  middlewareBaseUrl: process.env.EFATURA_MIDDLEWARE_BASE_URL,
  dfaBaseUrl: process.env.EFATURA_DFA_BASE_URL,
  environment: process.env.EFATURA_ENVIRONMENT,
});

const invoice = efatura
  .invoice()
  .type(DocumentType.ElectronicInvoice)
  .issueDate('2026-02-08')
  .emitter({ nif: '100200300', name: 'Emitter' })
  .receiver({ nif: '900800700', name: 'Receiver' })
  .line({
    description: 'Item',
    quantity: 1,
    unitPrice: 1000,
    total: 1000,
    taxes: [{ type: 'IVA', rate: 15, amount: 150 }],
  })
  .totals({ subtotal: 1000, taxTotal: 150, grandTotal: 1150 })
  .validate();

console.log(invoice.id); // UUID
```

## Current Scope

- Resolves DNRE repository environments: `PRODUCTION`, `HOMOLOGATION`, and `TEST`.
- Validates transmitter, software, middleware, platform, and DFA configuration.
- Supports all official e-Fatura v11.0 DFE document type codes.
- Uses Zod schemas for domain value objects and HTTP adapter payloads.
- Validates parties, taxes, totals, invoice lines, note references, and sales receipt receiver thresholds.
- Generates local document, submission, and batch identifiers with UUIDs.
- Generates and validates IUD values with Luhn check digits.
- Generates compact DFE XML using the v11 document-element mapping.
- Packages DFE XML files into Deflate ZIP payloads.
- Submits ZIP payloads through middleware and platform transport contracts.
- Builds DFA QR Code URLs from a configurable base URL.
- Renders DFA PDFs through the injectable PDF renderer.
- Exposes Express, Fastify, and Nest adapters.

## Official Artifacts Required

- Official XSD files must be provided through an `XsdValidator`.
- XAdES-BES signing must be provided through a certificate-backed `XmlSigner`.
- Official golden vectors must be provided through a `GoldenVectorRepository`.
- Database-backed sequence storage can be provided through a `SequenceStore`.

## Documentation

- [Documentation index](docs/00-index.md)
- [Installation](docs/01-installation.md)
- [Configuration](docs/02-configuration.md)
- [Quick Start](docs/03-quick-start.md)
- [Technical Briefing](docs/04-technical-briefing.md)
- [XML v11](docs/05-xml-v11.md)
- [Validation And Zod](docs/06-validation-zod.md)
- [Packaging](docs/07-packaging.md)
- [Adapters](docs/08-adapters.md)
- [Architecture](docs/10-architecture.md)

## Testing

```sh
bun test
```

## License

MIT
