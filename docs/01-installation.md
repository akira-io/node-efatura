# Installation

## Requirements

- Node.js 20 or higher
- Bun for local development and lockfile management

## Install the Package

```bash
# Bun. Recommended for this repository.
bun add @akira-io/efatura

# npm. Use when your project is npm-based.
npm install @akira-io/efatura

# pnpm. Use when your project is pnpm-based.
pnpm add @akira-io/efatura
```

The package ships runtime dependencies for validation and DFA PDF generation:

- `zod`, for domain and presentation schemas.
- `pdfkit`, for the default DFA PDF renderer.
- `qrcode`, for DFA QR Code images.
- `xml-crypto` and `@xmldom/xmldom`, for XML canonicalization and parsing.

The default XSD validator uses `xmllint`. On macOS it is available through the system `libxml2` tools.

Framework adapters and ORM-backed storage are optional peer dependencies. Install only what you use:

```bash
bun add express
bun add fastify
bun add @nestjs/common @nestjs/core reflect-metadata
bun add knex
bun add prisma @prisma/client
```

`knex` is only required for the database-backed sequence store at `@akira-io/efatura/knex`. The in-memory and file sequence stores ship in the root entry and need no extra dependency.

`prisma` and `@prisma/client` are only required for the Prisma-backed sequence store at `@akira-io/efatura/prisma`.

## Import

```ts
import { createEfatura } from '@akira-io/efatura';
```
