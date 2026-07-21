# Documentation

`@akira-io/efatura` is a framework-agnostic Node.js package for Cabo Verde e-Fatura documents.

## Guides

| # | Guide | Description |
|---|-------|-------------|
| 01 | [Installation](01-installation.md) | Package install and runtime requirements |
| 02 | [Configuration](02-configuration.md) | `createEfatura` options and defaults |
| 03 | [Quick Start](03-quick-start.md) | Build and validate an invoice |
| 04 | [Technical Briefing](04-technical-briefing.md) | e-Fatura v11.0 rules used as implementation reference |
| 05 | [XML v11](05-xml-v11.md) | DFE XML envelope, document elements, and XSD validation boundary |
| 06 | [Validation And Zod](06-validation-zod.md) | Domain schemas, HTTP schemas, and core boundary rules |
| 07 | [Packaging](07-packaging.md) | ZIP Deflate packaging and transport split |
| 08 | [Adapters](08-adapters.md) | Express, Fastify, and Nest adapters |
| 09 | [Storage](09-storage.md) | Sequence stores, Prisma model copy command, and counter migration |
| 10 | [Architecture](10-architecture.md) | Clean architecture layout and dependency direction |
| 11 | [Compliance Matrix](11-compliance-matrix.md) | Manual v11 and XML-XSD coverage status |
| 12 | [API Reference](12-api-reference.md) | Public facade methods and return contracts |
| 13 | [Workflows](13-workflows.md) | End-to-end invoice, signing, ZIP, submit, and DFA flows |
| 14 | [DFA](14-dfa.md) | PDF rendering, QR URL, pagination, and custom renderer contract |
| 15 | [Events](15-events.md) | FDC and UDN event XML |
| 16 | [Signing And Certificates](16-signing-certificates.md) | XAdES-BES signing and certificate validation |
| 17 | [Troubleshooting](17-troubleshooting.md) | Prisma, adapters, CORS, signing, XSD, and runtime issues |
| 18 | [Currency Conversion](18-currency-conversion.md) | Fiscal CVE preparation, exchange-rate providers, evidence, and reprints |

## Examples

| Example | Description |
|---------|-------------|
| [Fastify Server](examples/fastify/server.md) | Mount the Fastify adapter behind application authentication |
| [Fastify Invoice Payload](examples/fastify/invoice.md) | Shared invoice factory used by SPA examples |
| [React](examples/fastify/react.md) | Call the Fastify adapter from a React SPA |
| [Vue](examples/fastify/vue.md) | Call the Fastify adapter from a Vue SPA |
| [Svelte](examples/fastify/svelte.md) | Call the Fastify adapter from a Svelte SPA |
| [EUR To CVE With A Fixed Rate](examples/currency/eur-to-cve.md) | Prepare XML and DFA output with deterministic conversion evidence |
