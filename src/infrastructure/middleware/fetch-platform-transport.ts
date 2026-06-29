import type {
  PlatformSubmissionResult,
  PlatformSubmitInput,
  PlatformTransport,
} from '../../core/contracts/platform-transport';
import { EfaturaValidationError } from '../../domain/errors';
import { stripTrailingSlashes } from '../../support/url';
import { normalizePlatformSubmissionResult, parseServiceBody } from './response-parser';

export type PlatformFetch = typeof fetch;

export class FetchPlatformTransport implements PlatformTransport {
  readonly #fetch: PlatformFetch;

  constructor(fetcher: PlatformFetch = defaultFetch()) {
    this.#fetch = fetcher;
  }

  async submitDfeZip(input: PlatformSubmitInput): Promise<PlatformSubmissionResult> {
    const form = new FormData();
    form.append('file', new Blob([input.zip], { type: 'application/octet-stream' }), 'dfe.zip');

    const response = await this.#fetch(`${stripTrailingSlashes(input.baseUrl)}/v1/dfe`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        'cv-ef-repository-code': String(input.repositoryCode),
      },
      body: form,
    });
    const rawBody = await response.text();

    return normalizePlatformSubmissionResult({
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      rawBody,
      body: parseServiceBody(rawBody, response.headers.get('content-type') ?? ''),
    });
  }
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
