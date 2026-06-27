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
  });

  it('exposes a Fastify plugin function', () => {
    expect(typeof efaturaFastifyPlugin).toBe('function');
  });

  it('creates a Nest dynamic module with the configured service', () => {
    const module = EfaturaModule.forRoot({ efatura });

    expect(module.controllers).toEqual([EfaturaController]);
    expect(module.exports).toEqual([EFATURA]);
    expect(module.providers).toEqual([{ provide: EFATURA, useValue: efatura }]);
  });
});
