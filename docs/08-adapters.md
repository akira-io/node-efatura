# Adapters

The package exposes optional HTTP adapters through subpath exports. They live in `src/presentation` and depend on the public `Efatura` facade.

## Express

```ts
import express from 'express';
import { createEfatura } from '@akira-io/efatura';
import { efaturaRoutes } from '@akira-io/efatura/express';

const app = express();
const efatura = createEfatura(config, dependencies);

app.use('/efatura', efaturaRoutes(efatura));
```

## Fastify

```ts
import Fastify from 'fastify';
import { createEfatura } from '@akira-io/efatura';
import { efaturaFastifyPlugin } from '@akira-io/efatura/fastify';

const fastify = Fastify();
const efatura = createEfatura(config, dependencies);

await fastify.register(efaturaFastifyPlugin, { efatura });
```

## Nest

```ts
import { Module } from '@nestjs/common';
import { createEfatura } from '@akira-io/efatura';
import { EfaturaModule } from '@akira-io/efatura/nest';

@Module({
  imports: [EfaturaModule.forRoot({ efatura: createEfatura(config, dependencies) })],
})
export class AppModule {}
```

## Routes

Adapters expose the same route set:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/dfe/xml` | Build DFE XML from invoice data and options |
| `POST` | `/event/xml` | Build official Event XML for `FDC` or `UDN` events |
| `POST` | `/dfe/zip` | Build a ZIP payload from `{ iud, xml }` files |
| `POST` | `/dfe/submit/middleware` | Submit a ZIP payload through the configured middleware transport |
| `GET` | `/dfa/:iud` | Render a DFA PDF for an IUD |

Request payloads are validated with the shared Zod schemas documented in [Validation And Zod](06-validation-zod.md).
