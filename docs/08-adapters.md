# Adapters

The package exposes optional HTTP adapters through subpath exports. They live in `src/presentation` and depend on the public `Efatura` facade.

Do not mount these routes on a public path without authentication. The adapters can build fiscal XML, create ZIP payloads, render DFA PDFs, and submit files through configured transports.

## Express

```ts
import express from 'express';
import { createEfatura } from '@akira-io/efatura';
import { efaturaRoutes } from '@akira-io/efatura/express';

const app = express();
const efatura = createEfatura(config, dependencies);

const requireEfaturaAccess: express.RequestHandler = (request, response, next) => {
  if (request.header('authorization') !== `Bearer ${process.env.EFATURA_ADAPTER_TOKEN}`) {
    response.sendStatus(401);
    return;
  }

  next();
};

app.use('/efatura', efaturaRoutes(efatura, { authorization: requireEfaturaAccess }));
```

## Fastify

```ts
import Fastify from 'fastify';
import { createEfatura } from '@akira-io/efatura';
import { efaturaFastifyPlugin } from '@akira-io/efatura/fastify';

const fastify = Fastify();
const efatura = createEfatura(config, dependencies);

await fastify.register(efaturaFastifyPlugin, {
  efatura,
  authorization: async (request, reply) => {
    if (request.headers.authorization !== `Bearer ${process.env.EFATURA_ADAPTER_TOKEN}`) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }
  },
});
```

## Nest

```ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { createEfatura } from '@akira-io/efatura';
import { EfaturaModule } from '@akira-io/efatura/nest';
import { EfaturaAdapterGuard } from './efatura-adapter.guard';

@Module({
  imports: [EfaturaModule.forRoot({ efatura: createEfatura(config, dependencies) })],
  providers: [{ provide: APP_GUARD, useClass: EfaturaAdapterGuard }],
})
export class AppModule {}
```

For Nest, use the standard guard system in the application that imports `EfaturaModule`. A route-specific guard or an `APP_GUARD` provider must reject unauthenticated requests before they reach the adapter controller.

## Storage

Document sequence stores implement the `SequenceStore` contract. The zero-dependency stores ship in the root entry:

```ts
import { InMemorySequenceStore, FileSequenceStore } from '@akira-io/efatura';

const sequenceStore = new FileSequenceStore('storage/efatura-sequences.json');
```

ORM-backed stores live behind their own subpath so the driver stays an optional peer dependency. The knex store is at `@akira-io/efatura/knex`:

```ts
import knex from 'knex';
import { KnexSequenceStore } from '@akira-io/efatura/knex';

const database = knex({ client: 'pg', connection: process.env.DATABASE_URL });
const sequenceStore = new KnexSequenceStore(database);

await sequenceStore.ensureSchema();
```

Pass the resulting store as the `sequenceStore` dependency to `createEfatura`. Install only the driver you use; the root entry never pulls in `knex`.

The Prisma store lives at `@akira-io/efatura/prisma`. Prisma generates its client from your own schema, so copy the shipped sequence model, then migrate:

```sh
npx @akira-io/efatura prisma
```

The command writes to `prisma/schema/efatura-sequence.prisma` by default for Prisma multi-file schemas. Use the options below for other layouts:

```sh
# Write to a custom path
npx @akira-io/efatura prisma --out prisma/efatura-sequence.prisma

# Append only model blocks to a single schema.prisma file
npx @akira-io/efatura prisma --models-only --print >> prisma/schema.prisma

# Print the shipped model without writing files
npx @akira-io/efatura prisma --print

# Replace an existing output file
npx @akira-io/efatura prisma --force
```

The model fragment also ships at `node_modules/@akira-io/efatura/resources/prisma/efatura-sequence.prisma` if you need to copy it manually:

```prisma
model EfaturaSequence {
  id            String   @id
  currentNumber BigInt
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

Then run your migration (`prisma migrate dev` or `prisma db push`).

```ts
import { PrismaClient } from '@prisma/client';
import { PrismaSequenceStore } from '@akira-io/efatura/prisma';

const prisma = new PrismaClient();
const sequenceStore = new PrismaSequenceStore(prisma.efaturaSequence);
```

Prisma 7+ requires a driver adapter when constructing `PrismaClient`; configure it according to your Prisma setup before passing the client here.

Pass `sequenceStore` to `createEfatura`. `next()` is gap-free where the database performs a native upsert (Postgres, MySQL, SQLite). Switching the sequence-store adapter does not transfer counters automatically; migrate the data once, or sequence numbers reset.

## Routes

Adapters expose the same route set:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/dfe/xml` | Build DFE XML from invoice data and options |
| `POST` | `/event/xml` | Build official Event XML for `FDC` or `UDN` events |
| `POST` | `/dfe/zip` | Build a ZIP payload from `{ iud, xml }` files |
| `POST` | `/dfe/submit/middleware` | Submit a ZIP payload through the configured middleware transport |
| `POST` | `/dfe/validate/fiscal-readiness` | Validate local invoice rules plus optional PE/DNRE readiness checks |
| `GET` | `/dfa/:iud` | Render a DFA PDF for an IUD |

Request payloads are validated with the shared Zod schemas documented in [Validation And Zod](06-validation-zod.md).

Fiscal readiness accepts `{ invoice, options }`. Without `options.accessToken`, external PE/DNRE checks return `skipped`; with a token, the configured fiscal authority clients validate taxpayers, registered software, and emitter authorization.
