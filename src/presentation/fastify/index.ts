import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Efatura } from '../../efatura';
import {
  type HttpResult,
  handleBuildEventXml,
  handleBuildXml,
  handleBuildZip,
  handleRenderDfa,
  handleSubmitMiddleware,
} from '../shared/http';

export interface EfaturaFastifyOptions {
  efatura: Efatura;
}

export async function efaturaFastifyPlugin(
  fastify: FastifyInstance,
  options: EfaturaFastifyOptions,
): Promise<void> {
  const { efatura } = options;

  fastify.post('/dfe/xml', async (request, reply) => {
    send(reply, await handleBuildXml(efatura, request.body));
  });
  fastify.post('/event/xml', async (request, reply) => {
    send(reply, await handleBuildEventXml(efatura, request.body));
  });
  fastify.post('/dfe/zip', async (request, reply) => {
    send(reply, await handleBuildZip(efatura, request.body));
  });
  fastify.post('/dfe/submit/middleware', async (request, reply) => {
    send(reply, await handleSubmitMiddleware(efatura, request.body));
  });
  fastify.get('/dfa/:iud', async (request, reply) => {
    const params = request.params as { iud?: string };

    send(reply, await handleRenderDfa(efatura, params.iud ?? ''));
  });
}

function send(reply: FastifyReply, result: HttpResult): void {
  for (const [name, value] of Object.entries(result.headers ?? {})) {
    reply.header(name, value);
  }

  reply.status(result.status).send(result.body);
}
