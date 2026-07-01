import { json, type RequestHandler, Router } from 'express';
import { EfaturaError } from '../../domain/errors';
import type { Efatura } from '../../efatura';
import {
  type HttpResult,
  handleBuildEventXml,
  handleBuildXml,
  handleBuildZip,
  handleFiscalReadiness,
  handleRenderDfa,
  handleRenderDfaFromBody,
  handleSubmitMiddleware,
} from '../shared/http';

export interface EfaturaRoutesOptions {
  basePath?: string;
  authorization?: RequestHandler | RequestHandler[];
  allowUnauthenticated?: boolean;
}

export function efaturaRoutes(efatura: Efatura, options: EfaturaRoutesOptions = {}): Router {
  const router = Router();
  const authorization = authorizationHandlers(options.authorization);

  assertAuthorization(authorization.length > 0, options.allowUnauthenticated);

  router.use(json({ limit: '10mb' }));
  if (authorization.length > 0) {
    router.use(...authorization);
  }
  router.post(
    '/dfe/xml',
    handle((req) => handleBuildXml(efatura, req.body)),
  );
  router.post(
    '/event/xml',
    handle((req) => handleBuildEventXml(efatura, req.body)),
  );
  router.post(
    '/dfe/zip',
    handle((req) => handleBuildZip(efatura, req.body)),
  );
  router.post(
    '/dfe/submit/middleware',
    handle((req) => handleSubmitMiddleware(efatura, req.body)),
  );
  router.post(
    '/dfe/validate/fiscal-readiness',
    handle((req) => handleFiscalReadiness(efatura, req.body)),
  );
  router.post(
    '/dfa',
    handle((req) => handleRenderDfaFromBody(efatura, req.body)),
  );
  router.get(
    '/dfa/:iud',
    handle((req) => handleRenderDfa(efatura, firstParam(req.params.iud))),
  );

  return router;
}

function assertAuthorization(hasAuthorization: boolean, allowUnauthenticated?: boolean): void {
  if (!hasAuthorization && allowUnauthenticated !== true) {
    throw new EfaturaError(
      'Efatura routes require an authorization handler. Pass `authorization`, or set `allowUnauthenticated: true` to opt out explicitly.',
    );
  }
}

function authorizationHandlers(
  authorization: EfaturaRoutesOptions['authorization'],
): RequestHandler[] {
  if (!authorization) {
    return [];
  }

  return Array.isArray(authorization) ? authorization : [authorization];
}

function handle(
  handler: (req: Parameters<RequestHandler>[0]) => Promise<HttpResult>,
): RequestHandler {
  return (req, res, next) => {
    handler(req)
      .then((result) => {
        for (const [name, value] of Object.entries(result.headers ?? {})) {
          res.setHeader(name, value);
        }

        res.status(result.status).send(result.body);
      })
      .catch(next);
  };
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
