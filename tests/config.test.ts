import { describe, expect, it } from 'vitest';
import { configAsArray, type EfaturaConfig, resolveConfig } from '../src/config';
import { Environment } from '../src/domain/enums/environment';
import { EfaturaValidationError } from '../src/domain/errors';

function makeConfig(overrides: EfaturaConfig = {}): EfaturaConfig {
  return {
    transmitterNif: '100200300',
    transmitterLed: '123',
    softwareCode: 'SW001',
    softwareName: 'Efatura Suite',
    softwareVersion: '1.0.0',
    middlewareBaseUrl: 'https://middleware.example',
    environment: 'TEST',
    ...overrides,
  };
}

describe('resolveConfig', () => {
  it('defaults repository environment to TEST when empty', () => {
    const config = resolveConfig(makeConfig({ environment: '' }));

    expect(config.environment).toBe(Environment.Test);
    expect(config.repositoryCode).toBe(3);
  });

  it('accepts environment by name, numeric string, and integer code', () => {
    expect(resolveConfig(makeConfig({ environment: 'PRODUCTION' })).repositoryCode).toBe(1);
    expect(resolveConfig(makeConfig({ environment: '  production  ' })).repositoryCode).toBe(1);
    expect(resolveConfig(makeConfig({ environment: '2' })).environment).toBe(
      Environment.Homologation,
    );
    expect(resolveConfig(makeConfig({ environment: 2 })).environment).toBe(
      Environment.Homologation,
    );
  });

  it('returns configured values and config array shape', () => {
    const config = resolveConfig(
      makeConfig({ environment: Environment.Homologation, defaultSerie: 'SER-A' }),
    );

    expect(config.transmitterNif).toBe('100200300');
    expect(config.transmitterLed).toBe('123');
    expect(config.defaultSerie).toBe('SER-A');
    expect(config.softwareCode).toBe('SW001');
    expect(config.middlewareBaseUrl).toBe('https://middleware.example');
    expect(config.dfaBaseUrl).toBe('https://pe.efatura.cv/dfe/view');
    expect(config.environment).toBe(Environment.Homologation);
    expect(config.repositoryCode).toBe(2);
  });

  it('resolves configured emitter defaults from transmitter values', () => {
    const config = resolveConfig(
      makeConfig({
        emitter: {
          name: 'Emitter',
          contacts: { email: 'issuer@example.cv', telephone: '5551234' },
        },
      }),
    );

    expect(config.emitter?.taxId.value).toBe('100200300');
    expect(config.emitter?.taxId.countryCode).toBe('CV');
    expect(config.emitter?.name).toBe('Emitter');
    expect(configAsArray(config).emitter?.taxId.value).toBe('100200300');
  });

  it('allows the DFA QR Code base URL to be configured', () => {
    const config = resolveConfig(makeConfig({ dfaBaseUrl: 'https://efatura.example/dfe' }));

    expect(config.dfaBaseUrl).toBe('https://efatura.example/dfe');
    expect(configAsArray(config).dfa.base_url).toBe('https://efatura.example/dfe');
  });

  it('fails on invalid environment values', () => {
    expect(() => resolveConfig(makeConfig({ environment: 'INVALID' }))).toThrow(
      EfaturaValidationError,
    );
  });

  it('requires transmitter and software fields', () => {
    expect(() => resolveConfig(makeConfig({ transmitterNif: '' }))).toThrow(
      'Transmitter NIF is required.',
    );
    expect(() => resolveConfig(makeConfig({ transmitterNif: '010020030' }))).toThrow(
      'Cabo Verde NIF must have 9 digits and cannot start with zero.',
    );
    expect(() => resolveConfig(makeConfig({ transmitterLed: '' }))).toThrow(
      'Transmitter LED code is required.',
    );
    expect(() => resolveConfig(makeConfig({ softwareCode: '' }))).toThrow(
      'Software code is required.',
    );
    expect(() => resolveConfig(makeConfig({ softwareName: '' }))).toThrow(
      'Software name is required.',
    );
    expect(() => resolveConfig(makeConfig({ softwareVersion: '' }))).toThrow(
      'Software version is required.',
    );
    expect(() => resolveConfig(makeConfig({ middlewareBaseUrl: '' }))).toThrow(
      'Middleware base URL is required.',
    );
  });

  it('uses UUID generators by default and allows overrides', () => {
    const config = resolveConfig(makeConfig());

    expect(config.generators.documentId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const overridden = resolveConfig(
      makeConfig({
        generators: {
          documentId: () => 'document-id',
        },
      }),
    );

    expect(overridden.generators.documentId()).toBe('document-id');
  });
});
