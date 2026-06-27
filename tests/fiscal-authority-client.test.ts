import { describe, expect, it } from 'vitest';
import {
  FetchEmitterAuthorizationClient,
  FetchSoftwareRegistryClient,
  FetchTaxpayerRegistryClient,
} from '../src/infrastructure';

describe('fetch fiscal authority clients', () => {
  it('maps taxpayer registry responses', async () => {
    const requests: string[] = [];
    const client = new FetchTaxpayerRegistryClient({
      fetcher: fetcher(requests, {
        exists: true,
        activityStarted: true,
        activityActive: true,
        hasFiscalFramework: true,
        name: 'Emitter',
      }),
    });
    const result = await client.lookupTaxpayer(
      { taxId: '100200300', role: 'emitter' },
      { baseUrl: 'https://pe.example', accessToken: 'token' },
    );

    expect(requests[0]).toBe('https://pe.example/v1/taxpayers/100200300');
    expect(result).toMatchObject({ exists: true, activityActive: true, name: 'Emitter' });
  });

  it('maps software registry and emitter authorization responses', async () => {
    const software = new FetchSoftwareRegistryClient({
      fetcher: fetcher([], { Registado: true }),
    });
    const authorization = new FetchEmitterAuthorizationClient({
      fetcher: fetcher([], { Autorizado: false, Erros: [{ Mensagem: 'Nao autorizado' }] }),
    });

    await expect(
      software.lookupSoftware(
        { code: 'SW001' },
        { baseUrl: 'https://pe.example', accessToken: 'token' },
      ),
    ).resolves.toMatchObject({ registered: true });
    await expect(
      authorization.checkEmitterAuthorization(
        { transmitterNif: '100200300', emitterNif: '200300400', softwareCode: 'SW001' },
        { baseUrl: 'https://pe.example', accessToken: 'token' },
      ),
    ).resolves.toMatchObject({
      authorized: false,
      issues: [{ message: 'Nao autorizado', raw: { Mensagem: 'Nao autorizado' } }],
    });
  });
});

function fetcher(requests: string[], responseBody: unknown): typeof fetch {
  return (async (url: string | URL | Request) => {
    requests.push(String(url));

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}
