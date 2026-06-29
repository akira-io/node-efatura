import type { FastifyInstance, FastifyReply, preHandlerHookHandler } from 'fastify';
import { EfaturaError } from '../../domain/errors';
import type { Efatura } from '../../efatura';
import {
  type HttpResult,
  handleBuildEventXml,
  handleBuildXml,
  handleBuildZip,
  handleFiscalReadiness,
  handleRenderDfa,
  handleSubmitMiddleware,
} from '../shared/http';

export interface EfaturaFastifyOptions {
  efatura: Efatura;
  authorization?: preHandlerHookHandler | preHandlerHookHandler[];
  allowUnauthenticated?: boolean;
}

export async function efaturaFastifyPlugin(
  fastify: FastifyInstance,
  options: EfaturaFastifyOptions,
): Promise<void> {
  const { efatura } = options;

  const routeOptions = fastifyRouteOptions(options.authorization);

  assertAuthorization((routeOptions.preHandler?.length ?? 0) > 0, options.allowUnauthenticated);

  fastify.post('/dfe/xml', routeOptions, async (request, reply) => {
    send(reply, await handleBuildXml(efatura, request.body));
  });
  fastify.post('/event/xml', routeOptions, async (request, reply) => {
    send(reply, await handleBuildEventXml(efatura, request.body));
  });
  fastify.post('/dfe/zip', routeOptions, async (request, reply) => {
    send(reply, await handleBuildZip(efatura, request.body));
  });
  fastify.post('/dfe/submit/middleware', routeOptions, async (request, reply) => {
    send(reply, await handleSubmitMiddleware(efatura, request.body));
  });
  fastify.post('/dfe/validate/fiscal-readiness', routeOptions, async (request, reply) => {
    send(reply, await handleFiscalReadiness(efatura, request.body));
  });
  fastify.get('/dfa/:iud', routeOptions, async (request, reply) => {
    const params = request.params as { iud?: string };

    send(reply, await handleRenderDfa(efatura, params.iud ?? ''));
  });
}

function assertAuthorization(hasAuthorization: boolean, allowUnauthenticated?: boolean): void {
  if (!hasAuthorization && allowUnauthenticated !== true) {
    throw new EfaturaError(
      'Efatura routes require an authorization handler. Pass `authorization`, or set `allowUnauthenticated: true` to opt out explicitly.',
    );
  }
}

function fastifyRouteOptions(authorization: EfaturaFastifyOptions['authorization']): {
  preHandler?: preHandlerHookHandler[];
} {
  if (!authorization) {
    return {};
  }

  return { preHandler: Array.isArray(authorization) ? authorization : [authorization] };
}

function send(reply: FastifyReply, result: HttpResult): void {
  for (const [name, value] of Object.entries(result.headers ?? {})) {
    reply.header(name, value);
  }

  reply.status(result.status).send(result.body);
}
