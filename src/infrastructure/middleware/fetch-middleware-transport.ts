import type {
  MiddlewareSubmissionResult,
  MiddlewareSubmitInput,
  MiddlewareTransport,
} from '../../core/contracts';
import { EfaturaValidationError } from '../../domain/errors';
import { stripTrailingSlashes } from '../../support/url';
import { normalizeSubmissionResult, parseServiceBody } from './response-parser';

export type MiddlewareFetch = typeof fetch;

export class FetchMiddlewareTransport implements MiddlewareTransport {
  readonly #fetch: MiddlewareFetch;

  constructor(fetcher: MiddlewareFetch = defaultFetch()) {
    this.#fetch = fetcher;
  }

  async submitDfeZip(input: MiddlewareSubmitInput): Promise<MiddlewareSubmissionResult> {
    const response = await this.#fetch(`${stripTrailingSlashes(input.baseUrl)}/v1/dfe`, {
      method: 'POST',
      headers: {
        'content-type': 'application/zip',
        'cv-ef-mw-core-transmitter-key': input.transmitterKey,
      },
      body: input.zip,
    });
    const rawBody = await response.text();

    return normalizeSubmissionResult({
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      rawBody,
      body: parseServiceBody(rawBody, response.headers.get('content-type') ?? ''),
    });
  }
}

function defaultFetch(): MiddlewareFetch {
  if (typeof globalThis.fetch !== 'function') {
    throw new EfaturaValidationError(
      'fetch',
      'A fetch implementation is required for middleware submission.',
      'middleware.fetch_required',
    );
  }

  return globalThis.fetch.bind(globalThis);
}
