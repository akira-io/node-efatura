import { describe, expect, it } from 'vitest';
import { createEfatura } from '../src/create-efatura';
import { baseInvoicePayload } from './helpers';

const liveTest = process.env.EFATURA_LIVE_TESTS === '1' ? it : it.skip;

describe('fiscal readiness live', () => {
  liveTest('validates taxpayer, software, and authorization against PE/DNRE', async () => {
    const env = liveEnvironment();
    const efatura = createEfatura({
      transmitterNif: env.transmitterNif,
      transmitterLed: env.transmitterLed,
      softwareCode: env.softwareCode,
      softwareName: env.softwareName,
      softwareVersion: env.softwareVersion,
      middlewareBaseUrl: env.baseUrl,
      platformBaseUrl: env.baseUrl,
    });
    const readiness = await efatura.validateFiscalReadiness(
      baseInvoicePayload({
        emitter: { taxId: { countryCode: 'CV', value: env.emitterNif } },
        receiver: { taxId: { countryCode: 'CV', value: env.receiverNif } },
      }),
      {
        accessToken: env.accessToken,
        baseUrl: env.baseUrl,
      },
    );

    expect(readiness.ok).toBe(true);
    expect(readiness.checks.every((check) => check.status === 'passed')).toBe(true);
  });
});

function liveEnvironment() {
  return {
    accessToken: requiredEnv('EFATURA_LIVE_ACCESS_TOKEN'),
    baseUrl: requiredEnv('EFATURA_LIVE_BASE_URL'),
    emitterNif: requiredEnv('EFATURA_LIVE_EMITTER_NIF'),
    receiverNif: requiredEnv('EFATURA_LIVE_RECEIVER_NIF'),
    softwareCode: requiredEnv('EFATURA_LIVE_SOFTWARE_CODE'),
    softwareName: requiredEnv('EFATURA_LIVE_SOFTWARE_NAME'),
    softwareVersion: requiredEnv('EFATURA_LIVE_SOFTWARE_VERSION'),
    transmitterLed: process.env.EFATURA_LIVE_TRANSMITTER_LED ?? '1',
    transmitterNif: requiredEnv('EFATURA_LIVE_TRANSMITTER_NIF'),
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required when EFATURA_LIVE_TESTS=1.`);
  }

  return value;
}
