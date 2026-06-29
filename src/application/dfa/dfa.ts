import {
  EmissionMode,
  type EmissionModeInput,
  normalizeEmissionMode,
} from '../../domain/enums/emission-mode';
import { EfaturaValidationError } from '../../domain/errors';
import { validateIud } from '../../domain/iud/iud';

export const CONTINGENCY_NOTICE = 'EMITIDO EM CONTINGENCIA';
export const OFFLINE_CONTINGENCY_NOTICE = 'EMITIDO EM CONTINGENCIA OFFLINE';
export const OFF_CONTINGENCY_NOTICE = 'EMITIDO EM CONTINGENCIA OFF';

export function dfaQrCodeUrl(iud: string, baseUrl: string): string {
  if (!validateIud(iud)) {
    throw new EfaturaValidationError('iud', 'IUD is invalid.', 'dfa.iud_invalid');
  }

  return `${assertHttpsBaseUrl(baseUrl).replace(/\/+$/, '')}/${encodeURIComponent(iud)}`;
}

function assertHttpsBaseUrl(baseUrl: string): string {
  let parsed: URL;

  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new EfaturaValidationError('baseUrl', 'DFA base URL is invalid.', 'dfa.base_url_invalid');
  }

  if (parsed.protocol !== 'https:') {
    throw new EfaturaValidationError(
      'baseUrl',
      'DFA base URL must use https.',
      'dfa.base_url_insecure',
    );
  }

  return baseUrl;
}

export function dfaContingencyNotice(value: boolean | EmissionModeInput): string | null {
  if (value === true) {
    return CONTINGENCY_NOTICE;
  }

  if (value === false) {
    return null;
  }

  const emissionMode = normalizeEmissionMode(value);

  if (emissionMode === EmissionMode.Offline) {
    return OFFLINE_CONTINGENCY_NOTICE;
  }

  if (emissionMode === EmissionMode.Off) {
    return OFF_CONTINGENCY_NOTICE;
  }

  return null;
}
