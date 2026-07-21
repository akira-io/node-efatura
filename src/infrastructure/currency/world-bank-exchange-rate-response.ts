import Decimal from 'decimal.js';
import { ExchangeRateError } from '../../domain/currency/exchange-rate-error';

export function parseWorldBankObservation(
  worldBankPayload: unknown,
  economy: string,
  indicator: string,
  year: number,
): Decimal {
  if (
    !Array.isArray(worldBankPayload) ||
    worldBankPayload.length < 2 ||
    !Array.isArray(worldBankPayload[1])
  ) {
    throw invalidWorldBankResponse('expected metadata and observations arrays');
  }

  const observation = worldBankPayload[1][0];

  if (observation === undefined || observation === null) {
    throw observationUnavailable(year);
  }

  if (typeof observation !== 'object') {
    throw invalidWorldBankResponse('observation must be an object');
  }

  const observationRecord = observation as Record<string, unknown>;

  if (
    observationRecord.value === null ||
    observationRecord.value === undefined ||
    observationRecord.date !== String(year)
  ) {
    throw observationUnavailable(year);
  }

  if (
    observationRecord.countryiso3code !== economy ||
    !hasIndicator(observationRecord.indicator, indicator)
  ) {
    throw invalidWorldBankResponse('observation provenance does not match the request');
  }

  try {
    const observationValue = new Decimal(observationRecord.value as Decimal.Value);

    if (!observationValue.isFinite() || observationValue.lte(0)) {
      throw new Error('Observation value must be positive and finite.');
    }

    return observationValue;
  } catch (cause) {
    throw invalidWorldBankResponse('observation value is not a positive decimal', cause);
  }
}

export async function readBoundedWorldBankResponse(
  httpResponse: Response,
  maximumBytes: number,
): Promise<string> {
  const contentLength = httpResponse.headers.get('content-length');

  if (contentLength !== null && /^\d+$/.test(contentLength)) {
    if (BigInt(contentLength) > BigInt(maximumBytes)) {
      throw invalidWorldBankResponse('response size exceeds the configured limit');
    }
  }

  if (!httpResponse.body) {
    return '';
  }

  const reader = httpResponse.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytesRead = 0;

  while (true) {
    const chunk = await reader.read();

    if (chunk.done) {
      chunks.push(decoder.decode());
      return chunks.join('');
    }

    bytesRead += chunk.value.byteLength;

    if (bytesRead > maximumBytes) {
      await reader.cancel().catch(() => undefined);
      throw invalidWorldBankResponse('response size exceeds the configured limit');
    }

    chunks.push(decoder.decode(chunk.value, { stream: true }));
  }
}

export function invalidWorldBankResponse(detail: string, cause?: unknown): ExchangeRateError {
  return new ExchangeRateError(
    'exchange_rate.response_invalid',
    `The World Bank exchange-rate response is invalid: ${detail}.`,
    { cause },
  );
}

function hasIndicator(indicatorMetadata: unknown, indicator: string): boolean {
  return (
    typeof indicatorMetadata === 'object' &&
    indicatorMetadata !== null &&
    (indicatorMetadata as Record<string, unknown>).id === indicator
  );
}

function observationUnavailable(year: number): ExchangeRateError {
  return new ExchangeRateError(
    'exchange_rate.date_unavailable',
    `The World Bank exchange-rate observation is unavailable for ${year}.`,
  );
}
