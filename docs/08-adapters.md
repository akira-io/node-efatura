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
