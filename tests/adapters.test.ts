import { describe, expect, it } from 'vitest';
import { createEfatura } from '../src/create-efatura';
import { efaturaRoutes } from '../src/presentation/express';
import { efaturaFastifyPlugin } from '../src/presentation/fastify';
import { EFATURA, EfaturaController, EfaturaModule } from '../src/presentation/nest';

const efatura = createEfatura({
  transmitterNif: '100200300',
  transmitterLed: '123',
  transmitterKey: 'k'.repeat(64),
  softwareCode: 'SW001',
  softwareName: 'Efatura Suite',
  softwareVersion: '1.0.0',
  middlewareBaseUrl: 'https://localhost:3443',
});

describe('HTTP adapters', () => {
  it('creates an Express router for e-Fatura endpoints', () => {
    const router = efaturaRoutes(efatura);

    expect(typeof router).toBe('function');
    expect(typeof router.use).toBe('function');
    expect(router.stack.map((layer: { route?: { path: string } }) => layer.route?.path)).toContain(
      '/event/xml',
    );
    expect(router.stack.map((layer: { route?: { path: string } }) => layer.route?.path)).toContain(
      '/dfe/validate/fiscal-readiness',
    );
  });

  it('registers Fastify routes for DFE and Event XML', async () => {
    const routes: string[] = [];
    const fastify = {
      post: (path: string) => routes.push(`POST ${path}`),
      get: (path: string) => routes.push(`GET ${path}`),
    };

    await efaturaFastifyPlugin(fastify as never, { efatura });

    expect(routes).toContain('POST /dfe/xml');
    expect(routes).toContain('POST /event/xml');
    expect(routes).toContain('POST /dfe/validate/fiscal-readiness');
  });

  it('creates a Nest dynamic module with the configured service', () => {
    const module = EfaturaModule.forRoot({ efatura });

    expect(module.controllers).toEqual([EfaturaController]);
    expect(module.exports).toEqual([EFATURA]);
    expect(module.providers).toEqual([{ provide: EFATURA, useValue: efatura }]);
    expect(typeof EfaturaController.prototype.buildEventXml).toBe('function');
    expect(typeof EfaturaController.prototype.validateFiscalReadiness).toBe('function');
  });
});
