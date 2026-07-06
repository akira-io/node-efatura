import { Environment, environmentCode, environmentFromValue } from './domain/enums/environment';
import { EfaturaValidationError } from './domain/errors';
import { normalizeCapeVerdeNif } from './domain/value-objects/tax-id';
import { generateUuid } from './support/generators';
import { messages } from './support/messages';
import { isRecord, optionalText, requiredText } from './support/normalizers';

export const DEFAULT_DFA_BASE_URL = 'https://pe.efatura.cv/dfe/view';
export const DEFAULT_PLATFORM_BASE_URL = 'https://services.efatura.cv';

export interface EfaturaGenerators {
  documentId: () => string;
  submissionId: () => string;
  batchId: () => string;
}

export interface EfaturaEmitterTaxIdConfig {
  countryCode?: string | number | null;
  value?: string | number | null;
}

export interface EfaturaEmitterConfig {
  reference?: string | number | null;
  fiscalFramework?: string | number | null;
  taxId?: EfaturaEmitterTaxIdConfig | null;
  name?: string | number | null;
  address?: Record<string, unknown> | null;
  contacts?: Record<string, unknown> | null;
}

export type ResolvedEfaturaEmitter = Record<string, unknown> & {
  taxId: {
    countryCode: string;
    value: string;
  };
};

export interface EfaturaConfig {
  transmitterNif?: string | number | null;
  transmitterLed?: string | number | null;
  transmitterKey?: string | number | null;
  defaultSerie?: string | number | null;
  emitter?: EfaturaEmitterConfig | null;
  softwareCode?: string | number | null;
  softwareName?: string | number | null;
  softwareVersion?: string | number | null;
  middlewareBaseUrl?: string | number | null;
  platformBaseUrl?: string | number | null;
  dfaBaseUrl?: string | number | null;
  environment?: Environment | string | number | null;
  generators?: Partial<EfaturaGenerators>;
}

export interface ResolvedEfaturaConfig {
  transmitterNif: string;
  transmitterLed: string;
  transmitterKey: string | null;
  defaultSerie: string | null;
  emitter: ResolvedEfaturaEmitter | null;
  softwareCode: string;
  softwareName: string;
  softwareVersion: string;
  middlewareBaseUrl: string;
  platformBaseUrl: string;
  dfaBaseUrl: string;
  environment: Environment;
  repositoryCode: number;
  generators: EfaturaGenerators;
}

export interface EfaturaConfigArray {
  transmitter: {
    nif: string;
    led: string;
    key: string | null;
  };
  emitter: ResolvedEfaturaEmitter | null;
  software: {
    code: string;
    name: string;
    version: string;
  };
  middleware: {
    base_url: string;
    environment: Environment;
    repository_code: number;
  };
  platform: {
    base_url: string;
  };
  dfa: {
    base_url: string;
  };
}

export function resolveConfig(config: EfaturaConfig): ResolvedEfaturaConfig {
  const environment = resolveEnvironment(config.environment);
  const transmitterNif = normalizeCapeVerdeNif(
    requiredText(
      config.transmitterNif,
      'transmitter.nif',
      messages.config.transmitterNifRequired,
      'config.transmitter_nif_required',
    ),
    'transmitter.nif',
  );
  const transmitterLed = requiredText(
    config.transmitterLed,
    'transmitter.led',
    messages.config.transmitterLedRequired,
    'config.transmitter_led_required',
  );

  return {
    transmitterNif,
    transmitterLed,
    transmitterKey: optionalText(config.transmitterKey),
    defaultSerie: optionalText(config.defaultSerie),
    emitter: defaultEmitterFrom(config.emitter, transmitterNif),
    softwareCode: requiredText(
      config.softwareCode,
      'software.code',
      messages.config.softwareCodeRequired,
      'config.software_code_required',
    ),
    softwareName: requiredText(
      config.softwareName,
      'software.name',
      messages.config.softwareNameRequired,
      'config.software_name_required',
    ),
    softwareVersion: requiredText(
      config.softwareVersion,
      'software.version',
      messages.config.softwareVersionRequired,
      'config.software_version_required',
    ),
    middlewareBaseUrl: requiredText(
      config.middlewareBaseUrl,
      'middleware.base_url',
      messages.config.middlewareBaseUrlRequired,
      'config.middleware_base_url_required',
    ),
    platformBaseUrl: optionalText(config.platformBaseUrl) ?? DEFAULT_PLATFORM_BASE_URL,
    dfaBaseUrl: optionalText(config.dfaBaseUrl) ?? DEFAULT_DFA_BASE_URL,
    environment,
    repositoryCode: environmentCode(environment),
    generators: {
      documentId: config.generators?.documentId ?? generateUuid,
      submissionId: config.generators?.submissionId ?? generateUuid,
      batchId: config.generators?.batchId ?? generateUuid,
    },
  };
}

export function configAsArray(config: ResolvedEfaturaConfig): EfaturaConfigArray {
  return {
    transmitter: {
      nif: config.transmitterNif,
      led: config.transmitterLed,
      key: config.transmitterKey,
    },
    emitter: config.emitter,
    software: {
      code: config.softwareCode,
      name: config.softwareName,
      version: config.softwareVersion,
    },
    middleware: {
      base_url: config.middlewareBaseUrl,
      environment: config.environment,
      repository_code: config.repositoryCode,
    },
    platform: {
      base_url: config.platformBaseUrl,
    },
    dfa: {
      base_url: config.dfaBaseUrl,
    },
  };
}

function defaultEmitterFrom(
  value: EfaturaConfig['emitter'],
  transmitterNif: string,
): ResolvedEfaturaEmitter | null {
  if (!isRecord(value)) {
    return null;
  }

  const taxId = isRecord(value.taxId) ? value.taxId : {};

  return {
    ...value,
    taxId: {
      countryCode: optionalText(taxId.countryCode) ?? 'CV',
      value: optionalText(taxId.value) ?? transmitterNif,
    },
  };
}

function resolveEnvironment(value: EfaturaConfig['environment']): Environment {
  const environment = environmentFromValue(value ?? Environment.Test);

  if (environment === null) {
    throw new EfaturaValidationError(
      'middleware.environment',
      messages.config.environmentInvalid,
      'config.environment_invalid',
    );
  }

  return environment;
}
