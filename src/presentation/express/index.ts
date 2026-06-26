import { json, type RequestHandler, Router } from 'express';
import type { Efatura } from '../../efatura';
import {
  type HttpResult,
  handleBuildXml,
  handleBuildZip,
  handleRenderDfa,
  handleSubmitMiddleware,
} from '../shared/http';

export interface EfaturaRoutesOptions {
  basePath?: string;
}

export function efaturaRoutes(efatura: Efatura, _options: EfaturaRoutesOptions = {}): Router {
  const router = Router();

  router.use(json({ limit: '10mb' }));
  router.post(
    '/dfe/xml',
    handle((req) => handleBuildXml(efatura, req.body)),
  );
  router.post(
    '/dfe/zip',
    handle((req) => handleBuildZip(efatura, req.body)),
  );
  router.post(
    '/dfe/submit/middleware',
    handle((req) => handleSubmitMiddleware(efatura, req.body)),
  );
  router.get(
    '/dfa/:iud',
    handle((req) => handleRenderDfa(efatura, firstParam(req.params.iud))),
  );

  return router;
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
