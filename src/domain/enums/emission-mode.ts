export const EmissionMode = {
  Online: 'Online',
  Offline: 'Offline',
  Off: 'Off',
} as const;

export type EmissionMode = (typeof EmissionMode)[keyof typeof EmissionMode];
export type EmissionModeInput = EmissionMode;

export const EMISSION_MODES = Object.values(EmissionMode) as readonly EmissionMode[];

export function emissionModeFromValue(value: unknown): EmissionMode | null {
  if (typeof value !== 'string') {
    return null;
  }

  return isEmissionMode(value) ? value : null;
}

export function normalizeEmissionMode(value: EmissionModeInput | null | undefined): EmissionMode {
  return emissionModeFromValue(value ?? EmissionMode.Online) ?? EmissionMode.Online;
}

export function isContingencyEmissionMode(value: EmissionModeInput): boolean {
  return normalizeEmissionMode(value) !== EmissionMode.Online;
}

export function isEmissionMode(value: string): value is EmissionMode {
  return (EMISSION_MODES as readonly string[]).includes(value);
}
