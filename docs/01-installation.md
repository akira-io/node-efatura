# Installation

## Requirements

- Node.js 20 or higher
- Bun for local development and lockfile management

## Install the Package

```bash
bun add @akira-io/efatura
```

The package ships runtime dependencies for validation and DFA PDF generation:

- `zod`, for domain and presentation schemas.
- `pdfkit`, for the default DFA PDF renderer.
- `qrcode`, for DFA QR Code images.
- `xml-crypto` and `@xmldom/xmldom`, for XML canonicalization and parsing.
- `knex`, for optional database-backed document sequence storage.

The default XSD validator uses `xmllint`. On macOS it is available through the system `libxml2` tools.

Framework adapters are optional peer dependencies. Install only the framework you use:

```bash
bun add express
bun add fastify
bun add @nestjs/common @nestjs/core reflect-metadata
```

## Import

```ts
import { createEfatura } from '@akira-io/efatura';
```
