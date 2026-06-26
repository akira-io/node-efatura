export const Environment = {
  Production: 'PRODUCTION',
  Homologation: 'HOMOLOGATION',
  Test: 'TEST',
} as const;

export type Environment = (typeof Environment)[keyof typeof Environment];

const ENVIRONMENT_CODES: Record<Environment, number> = {
  [Environment.Production]: 1,
  [Environment.Homologation]: 2,
  [Environment.Test]: 3,
};

export function environmentCode(environment: Environment): number {
  return ENVIRONMENT_CODES[environment];
}

export function environmentFromValue(value: unknown): Environment | null {
  if (typeof value === 'number') {
    return environmentFromCode(value);
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();

  if (normalized === '') {
    return Environment.Test;
  }

  const upper = normalized.toUpperCase();

  if (isEnvironment(upper)) {
    return upper;
  }

  if (/^\d+$/.test(normalized)) {
    return environmentFromCode(Number(normalized));
  }

  return null;
}

export function isEnvironment(value: string): value is Environment {
  return Object.values(Environment).includes(value as Environment);
}

function environmentFromCode(value: number): Environment | null {
  for (const [environment, code] of Object.entries(ENVIRONMENT_CODES)) {
    if (code === value) {
      return environment as Environment;
    }
  }

  return null;
}
