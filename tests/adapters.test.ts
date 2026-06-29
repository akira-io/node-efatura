import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
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

interface ExpressLayer {
  route?: { path: string };
  handle: RequestHandler;
}

describe('HTTP adapters', () => {
  it('creates an Express router for e-Fatura endpoints', () => {
    const router = efaturaRoutes(efatura, { allowUnauthenticated: true });

    expect(typeof router).toBe('function');
    expect(typeof router.use).toBe('function');
    expect(router.stack.map((layer: { route?: { path: string } }) => layer.route?.path)).toContain(
      '/event/xml',
    );
    expect(router.stack.map((layer: { route?: { path: string } }) => layer.route?.path)).toContain(
      '/dfe/validate/fiscal-readiness',
    );
  });

  it('runs Express authorization before fiscal handlers', () => {
    const authorization: RequestHandler = (_request, response) => {
      response.status(401).json({ message: 'Unauthorized' });
    };
    const router = efaturaRoutes(efatura, { authorization });
    const stack = (router as unknown as { stack: ExpressLayer[] }).stack;
    const authorizationIndex = stack.findIndex((layer) => layer.handle === authorization);
    const firstRouteIndex = stack.findIndex((layer) => layer.route?.path === '/dfe/xml');
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next: NextFunction = vi.fn();

    stack[authorizationIndex]?.handle({} as Request, response, next);

    expect(authorizationIndex).toBeGreaterThan(-1);
    expect(authorizationIndex).toBeLessThan(firstRouteIndex);
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('registers Fastify routes for DFE and Event XML', async () => {
    const routes: string[] = [];
    const routeOptions: unknown[] = [];
    const authorization = () => undefined;
    const fastify = {
      post: (path: string, options: unknown) => {
        routes.push(`POST ${path}`);
        routeOptions.push(options);
      },
      get: (path: string, options: unknown) => {
        routes.push(`GET ${path}`);
        routeOptions.push(options);
      },
    };

    await efaturaFastifyPlugin(fastify as never, { efatura, authorization });

    expect(routes).toContain('POST /dfe/xml');
    expect(routes).toContain('POST /event/xml');
    expect(routes).toContain('POST /dfe/validate/fiscal-readiness');
    expect(routeOptions).toContainEqual({ preHandler: [authorization] });
  });

  it('creates a Nest dynamic module with the configured service', () => {
    const module = EfaturaModule.forRoot({ efatura, allowUnauthenticated: true });

    expect(module.controllers).toEqual([EfaturaController]);
    expect(module.exports).toEqual([EFATURA]);
    expect(module.providers).toEqual([{ provide: EFATURA, useValue: efatura }]);
    expect(typeof EfaturaController.prototype.buildEventXml).toBe('function');
    expect(typeof EfaturaController.prototype.validateFiscalReadiness).toBe('function');
  });

  it('fails closed when no authorization is supplied', async () => {
    expect(() => efaturaRoutes(efatura)).toThrow(/authorization handler/);

    await expect(
      efaturaFastifyPlugin({ post() {}, get() {} } as never, { efatura }),
    ).rejects.toThrow(/authorization handler/);

    expect(() => EfaturaModule.forRoot({ efatura })).toThrow(/unauthenticated routes/);
  });
});
