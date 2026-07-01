# Storage

`@akira-io/efatura` uses a `SequenceStore` to allocate fiscal document numbers before building sequential IUDs. The sequence scope is:

- transmitter NIF
- fiscal year
- LED code
- document type

Use a durable store in production. The in-memory store is useful for tests only.

## Contract

```ts
import type { SequenceStore } from '@akira-io/efatura';

const sequenceStore: SequenceStore = {
  async next(scope) {
    return 1;
  },
  async current(scope) {
    return null;
  },
  async reset(scope) {
    return;
  },
};
```

Pass the store to `createEfatura`:

```ts
import { createEfatura } from '@akira-io/efatura';

const efatura = createEfatura(config, { sequenceStore });
const iud = await efatura.buildSequentialIud({
  issueDate: '2026-02-08',
  documentType: 'FTE',
  randomCode: '1234567890',
});
```

`buildSequentialIud()` calls `nextDocumentNumber()`, then builds the IUD with the generated number.

## Store Options

| Store | Import | Use case |
|-------|--------|----------|
| `InMemorySequenceStore` | `@akira-io/efatura` | Unit tests and disposable demos |
| `FileSequenceStore` | `@akira-io/efatura` | Local development or single-process tools |
| `KnexSequenceStore` | `@akira-io/efatura/knex` | Production apps that already use Knex |
| `PrismaSequenceStore` | `@akira-io/efatura/prisma` | Production apps that already use Prisma |

The root entry does not import Knex or Prisma. Install only the adapter you use.

## In-Memory Store

```ts
import { InMemorySequenceStore } from '@akira-io/efatura';

const sequenceStore = new InMemorySequenceStore();
```

This store resets when the process restarts. It serializes concurrent `next()` calls inside the process, but it is not durable and must not be used for production fiscal numbering.

## File Store

```ts
import { FileSequenceStore } from '@akira-io/efatura';

const sequenceStore = new FileSequenceStore('storage/efatura-sequences.json');
```

The file store persists numbers to JSON and serializes concurrent calls in the current process. Use it for local development, command-line tools, and controlled single-process deployments. Do not share the same file across multiple app instances.

## Knex Store

```ts
import knex from 'knex';
import { KnexSequenceStore } from '@akira-io/efatura/knex';

const database = knex({ client: 'pg', connection: process.env.DATABASE_URL });
const sequenceStore = new KnexSequenceStore(database);

await sequenceStore.ensureSchema();
```

`ensureSchema()` creates the `efatura_sequences` table when it does not exist. The store keeps sequence numbers unique and gap-free where the database can run the native upsert transaction used by the adapter.

## Prisma Store

Copy the shipped model into your Prisma schema:

```sh
npx @akira-io/efatura prisma
```

The command writes to `prisma/schema/efatura-sequence.prisma` by default.

Useful options:

```sh
# Write to a custom path
npx @akira-io/efatura prisma --out prisma/efatura-sequence.prisma

# Print the fragment without writing files
npx @akira-io/efatura prisma --print

# Print only model blocks so you can append to a single schema.prisma file
npx @akira-io/efatura prisma --models-only --print

# Replace an existing output file
npx @akira-io/efatura prisma --force
```

The model also ships at `resources/prisma/efatura-sequence.prisma`.

```prisma
model EfaturaSequence {
  id            String   @id
  currentNumber BigInt
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

After copying the model, run your normal Prisma migration command:

```sh
npx prisma migrate dev
```

or, for development environments that use schema push:

```sh
npx prisma db push
```

Then wire the generated delegate:

```ts
import { PrismaClient } from '@prisma/client';
import { PrismaSequenceStore } from '@akira-io/efatura/prisma';

const prisma = new PrismaClient();
const sequenceStore = new PrismaSequenceStore(prisma.efaturaSequence);
```

Prisma 7 and newer require a driver adapter when constructing `PrismaClient`. Configure Prisma according to your application before passing the generated delegate to `PrismaSequenceStore`.

## Migrating Counters

Changing adapters does not copy counters. Move the current value for every active sequence scope before switching stores, or the next generated document number may restart from `1`.

The scope key must preserve:

- transmitter NIF
- fiscal year
- LED code
- document type

## Production Notes

- Keep one sequence source for each emitter and LED.
- Use Knex or Prisma when multiple app instances can issue documents.
- Back up sequence data with the rest of the billing database.
- Restrict manual resets to controlled recovery operations.
