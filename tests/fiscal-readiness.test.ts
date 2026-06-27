import { describe, expect, it } from 'vitest';
import type {
  EmitterAuthorizationClient,
  SoftwareRegistryClient,
  TaxpayerRegistryClient,
} from '../src/core/contracts';
import { createEfatura } from '../src/create-efatura';
import { baseInvoicePayload } from './helpers';

describe('fiscal readiness', () => {
  it('skips external checks when no PE/DNRE access token is provided', async () => {
    const result = await createEfatura(config()).validateFiscalReadiness(baseInvoicePayload());

    expect(result.ok).toBe(true);
    expect(result.checks).toEqual([
      {
        code: 'fiscal_authority.access_token_required',
        message: 'Fiscal authority access token was not provided.',
        status: 'skipped',
      },
    ]);
  });

  it('passes taxpayer, software, and authorization checks through injected clients', async () => {
    const calls: string[] = [];
    const efatura = createEfatura(config(), {
      taxpayerRegistryClient: taxpayerClient(calls),
      softwareRegistryClient: softwareClient(true),
      emitterAuthorizationClient: authorizationClient(true),
    });
    const result = await efatura.validateFiscalReadiness(
      baseInvoicePayload({ emitter: { taxId: { countryCode: 'CV', value: '200300400' } } }),
      { accessToken: 'token' },
    );

    expect(result.ok).toBe(true);
    expect(result.checks.every((check) => check.status === 'passed')).toBe(true);
    expect(calls).toContain('transmitter:100200300');
    expect(calls).toContain('emitter:200300400');
    expect(result.checks.map((check) => check.code)).toContain('emitter.authorization');
  });

  it('fails when an external registry reports a rejected check', async () => {
    const efatura = createEfatura(config(), {
      taxpayerRegistryClient: taxpayerClient([]),
      softwareRegistryClient: softwareClient(false),
      emitterAuthorizationClient: authorizationClient(true),
    });
    const result = await efatura.validateFiscalReadiness(baseInvoicePayload(), {
      accessToken: 'token',
    });

    expect(result.ok).toBe(false);
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        code: 'software.registered',
        status: 'failed',
        message: 'Software is not registered.',
      }),
    );
  });
});

function taxpayerClient(calls: string[]): TaxpayerRegistryClient {
  return {
    async lookupTaxpayer(input) {
      calls.push(`${input.role}:${input.taxId}`);

      return {
        exists: true,
        activityActive: true,
        activityStarted: true,
        hasFiscalFramework: true,
      };
    },
  };
}

function softwareClient(registered: boolean): SoftwareRegistryClient {
  return {
    async lookupSoftware() {
      return {
        registered,
        issues: registered ? [] : [{ message: 'Software is not registered.' }],
      };
    },
  };
}

function authorizationClient(authorized: boolean): EmitterAuthorizationClient {
  return {
    async checkEmitterAuthorization() {
      return { authorized };
    },
  };
}

function config() {
  return {
    transmitterNif: '100200300',
    transmitterLed: '123',
    softwareCode: 'SW001',
    softwareName: 'Efatura Suite',
    softwareVersion: '1.0.0',
    middlewareBaseUrl: 'https://localhost:3443',
  };
}
