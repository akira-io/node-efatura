# Fastify Server Example

This example mounts the e-Fatura adapter under `/efatura`. Keep this route behind the same authentication boundary as the back-office or billing area that issues fiscal documents.

```sh
npm install fastify @fastify/cors @akira-io/efatura
```

```ts
import cors from '@fastify/cors';
import { createEfatura } from '@akira-io/efatura';
import { efaturaFastifyPlugin } from '@akira-io/efatura/fastify';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';

const app = Fastify({ logger: true });

const efatura = createEfatura(
  {
    transmitterNif: process.env.EFATURA_TRANSMITTER_NIF ?? '100200300',
    transmitterLed: process.env.EFATURA_TRANSMITTER_LED ?? '123',
    transmitterKey: process.env.EFATURA_TRANSMITTER_KEY ?? 'development-key',
    softwareCode: process.env.EFATURA_SOFTWARE_CODE ?? 'SW001',
    softwareName: process.env.EFATURA_SOFTWARE_NAME ?? 'Billing App',
    softwareVersion: process.env.EFATURA_SOFTWARE_VERSION ?? '1.0.0',
    middlewareBaseUrl: process.env.EFATURA_MIDDLEWARE_URL ?? 'https://middleware.example',
    dfaBaseUrl: process.env.EFATURA_DFA_BASE_URL ?? 'https://pe.efatura.cv/dfe/view',
    environment: process.env.EFATURA_ENVIRONMENT ?? 'TEST',
  },
  {
    taxpayerRegistryClient: { lookupTaxpayer: async () => ({ exists: true }) },
    softwareRegistryClient: { lookupSoftware: async () => ({ registered: true }) },
    emitterAuthorizationClient: {
      checkEmitterAuthorization: async () => ({ authorized: true }),
    },
  },
);

await app.register(cors, {
  origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  credentials: true,
});

await app.register(efaturaFastifyPlugin, {
  prefix: '/efatura',
  efatura,
  authorization: requireFiscalAccess,
});

await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });

async function requireFiscalAccess(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const session = await validateSession(request.headers.cookie);

  if (!session?.canIssueFiscalDocuments) {
    await reply.code(401).send({ message: 'Unauthorized' });
  }
}

async function validateSession(
  cookieHeader: string | undefined,
): Promise<{ canIssueFiscalDocuments: boolean } | null> {
  if (!cookieHeader) {
    return null;
  }

  return { canIssueFiscalDocuments: true };
}
```

Replace `validateSession` with the session lookup used by your application. Browser clients should not receive middleware credentials, certificates, or fiscal authority tokens.

The mounted routes are available at:

| Method | Path |
|--------|------|
| `POST` | `/efatura/dfe/xml` |
| `POST` | `/efatura/event/xml` |
| `POST` | `/efatura/dfe/zip` |
| `POST` | `/efatura/dfe/submit/middleware` |
| `POST` | `/efatura/dfe/validate/fiscal-readiness` |
| `POST` | `/efatura/dfa` |
| `GET` | `/efatura/dfa/:iud` |
