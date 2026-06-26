import type {
  PlatformSubmissionResult,
  PlatformSubmitInput,
  PlatformTransport,
} from '../../core/contracts/platform-transport';
import { EfaturaValidationError } from '../../domain/errors';
import { parseServiceBody } from './response-parser';

export type PlatformFetch = typeof fetch;

export class FetchPlatformTransport implements PlatformTransport {
  readonly #fetch: PlatformFetch;

  constructor(fetcher: PlatformFetch = defaultFetch()) {
    this.#fetch = fetcher;
  }

  async submitDfeZip(input: PlatformSubmitInput): Promise<PlatformSubmissionResult> {
    const form = new FormData();
    form.append('file', new Blob([input.zip], { type: 'application/octet-stream' }), 'dfe.zip');

    const response = await this.#fetch(`${input.baseUrl.replace(/\/+$/, '')}/v1/dfe`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        'cv-ef-repository-code': String(input.repositoryCode),
      },
      body: form,
    });
    const rawBody = await response.text();
    const body = parseServiceBody(rawBody, response.headers.get('content-type') ?? '');

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      rawBody,
      body,
      errors: extractErrors(body),
    };
  }
}

function extractErrors(body: unknown): PlatformSubmissionResult['errors'] {
  if (!isRecord(body)) {
    return [];
  }

  const value = body.errors ?? body.error ?? body.validationErrors;
  const list = Array.isArray(value) ? value : value ? [value] : [];

  return list.map((item) => {
    if (isRecord(item)) {
      return {
        code: asText(item.code ?? item.Code),
        message: asText(item.message ?? item.Message) ?? 'Submission failed.',
        field: asText(item.field ?? item.Field),
        raw: item,
      };
    }

    return { message: String(item), raw: item };
  });
}

function defaultFetch(): PlatformFetch {
  if (typeof globalThis.fetch !== 'function') {
    throw new EfaturaValidationError(
      'fetch',
      'A fetch implementation is required for platform submission.',
      'platform.fetch_required',
    );
  }

  return globalThis.fetch.bind(globalThis);
}

function asText(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
