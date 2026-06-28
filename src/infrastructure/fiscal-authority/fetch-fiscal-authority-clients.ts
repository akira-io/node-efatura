import type {
  EmitterAuthorizationClient,
  EmitterAuthorizationInput,
  EmitterAuthorizationResult,
  FiscalAuthorityIssue,
  FiscalAuthorityRequestContext,
  SoftwareLookupInput,
  SoftwareLookupResult,
  SoftwareRegistryClient,
  TaxpayerLookupInput,
  TaxpayerLookupResult,
  TaxpayerRegistryClient,
} from '../../core/contracts';
import { EfaturaValidationError } from '../../domain/errors';
import { parseServiceBody } from '../middleware/response-parser';

type FiscalAuthorityFetch = typeof fetch;
type PathBuilder<T> = (input: T) => string;

export interface FetchTaxpayerRegistryClientOptions {
  fetcher?: FiscalAuthorityFetch;
  path?: PathBuilder<TaxpayerLookupInput>;
}

export interface FetchSoftwareRegistryClientOptions {
  fetcher?: FiscalAuthorityFetch;
  path?: PathBuilder<SoftwareLookupInput>;
}

export interface FetchEmitterAuthorizationClientOptions {
  fetcher?: FiscalAuthorityFetch;
  path?: PathBuilder<EmitterAuthorizationInput>;
}

export class FetchTaxpayerRegistryClient implements TaxpayerRegistryClient {
  readonly #fetch: FiscalAuthorityFetch;
  readonly #path: PathBuilder<TaxpayerLookupInput>;

  constructor(options: FetchTaxpayerRegistryClientOptions = {}) {
    this.#fetch = options.fetcher ?? defaultFetch();
    this.#path = options.path ?? ((input) => `/v1/taxpayers/${encodeURIComponent(input.taxId)}`);
  }

  async lookupTaxpayer(
    input: TaxpayerLookupInput,
    context: FiscalAuthorityRequestContext,
  ): Promise<TaxpayerLookupResult> {
    const body = await fetchJson(this.#fetch, context, this.#path(input));
    const exists = requiredBooleanValue(
      body,
      ['exists', 'Exists', 'existe', 'Existe'],
      'taxpayer.exists',
    );

    return {
      exists: exists.value,
      activityStarted: optionalBooleanValue(body, ['activityStarted', 'AtividadeIniciada']),
      activityActive: optionalBooleanValue(body, ['activityActive', 'AtividadeAtiva']),
      hasFiscalFramework: optionalBooleanValue(body, ['hasFiscalFramework', 'EnquadramentoFiscal']),
      name: textValue(body, ['name', 'Name', 'nome', 'Nome']),
      issues: issuesFromBody(body, exists.issue),
      raw: body,
    };
  }
}

export class FetchSoftwareRegistryClient implements SoftwareRegistryClient {
  readonly #fetch: FiscalAuthorityFetch;
  readonly #path: PathBuilder<SoftwareLookupInput>;

  constructor(options: FetchSoftwareRegistryClientOptions = {}) {
    this.#fetch = options.fetcher ?? defaultFetch();
    this.#path =
      options.path ?? ((input) => `/v1/software/${encodeURIComponent(input.code.toLowerCase())}`);
  }

  async lookupSoftware(
    input: SoftwareLookupInput,
    context: FiscalAuthorityRequestContext,
  ): Promise<SoftwareLookupResult> {
    const body = await fetchJson(this.#fetch, context, this.#path(input));
    const registered = requiredBooleanValue(
      body,
      ['registered', 'Registered', 'registado', 'Registado'],
      'software.registered',
    );

    return {
      registered: registered.value,
      issues: issuesFromBody(body, registered.issue),
      raw: body,
    };
  }
}

export class FetchEmitterAuthorizationClient implements EmitterAuthorizationClient {
  readonly #fetch: FiscalAuthorityFetch;
  readonly #path: PathBuilder<EmitterAuthorizationInput>;

  constructor(options: FetchEmitterAuthorizationClientOptions = {}) {
    this.#fetch = options.fetcher ?? defaultFetch();
    this.#path =
      options.path ??
      ((input) =>
        `/v1/emitters/${encodeURIComponent(input.emitterNif)}/authorizations/${encodeURIComponent(
          input.transmitterNif,
        )}?softwareCode=${encodeURIComponent(input.softwareCode)}`);
  }

  async checkEmitterAuthorization(
    input: EmitterAuthorizationInput,
    context: FiscalAuthorityRequestContext,
  ): Promise<EmitterAuthorizationResult> {
    const body = await fetchJson(this.#fetch, context, this.#path(input));
    const authorized = requiredBooleanValue(
      body,
      ['authorized', 'Authorized', 'autorizado', 'Autorizado'],
      'emitter.authorization',
    );

    return {
      authorized: authorized.value,
      issues: issuesFromBody(body, authorized.issue),
      raw: body,
    };
  }
}

async function fetchJson(
  fetcher: FiscalAuthorityFetch,
  context: FiscalAuthorityRequestContext,
  path: string,
): Promise<unknown> {
  const response = await fetcher(`${context.baseUrl.replace(/\/+$/, '')}${path}`, {
    headers: { authorization: `Bearer ${context.accessToken}` },
  });
  const rawBody = await response.text();
  const body = parseServiceBody(rawBody, response.headers.get('content-type') ?? '');

  if (!response.ok) {
    throw new EfaturaValidationError(
      'fiscalAuthority',
      response.statusText || 'Fiscal authority request failed.',
      'fiscal_authority.request_failed',
    );
  }

  return body;
}

function issuesFromBody(body: unknown, additionalIssue?: FiscalAuthorityIssue) {
  const issues = arrayValue(body, ['errors', 'Errors', 'erros', 'Erros']);
  const parsedIssues = issues.filter(isRecord).map((issue) => ({
    code: textValue(issue, ['code', 'Code', 'codigo', 'Codigo']),
    field: textValue(issue, ['field', 'Field', 'campo', 'Campo']),
    severity: textValue(issue, ['severity', 'Severity', 'severidade', 'Severidade']),
    message:
      textValue(issue, ['message', 'Message', 'mensagem', 'Mensagem']) ?? 'Validation failed.',
    details: textValue(issue, ['details', 'Details', 'detalhes', 'Detalhes']),
    raw: issue,
  }));

  return additionalIssue ? [...parsedIssues, additionalIssue] : parsedIssues;
}

function requiredBooleanValue(
  body: unknown,
  keys: string[],
  field: string,
): { value: boolean; issue?: FiscalAuthorityIssue } {
  const value = optionalBooleanValue(body, keys);

  if (value !== undefined) {
    return { value };
  }

  return {
    value: false,
    issue: {
      code: 'fiscal_authority.unrecognized_response',
      field,
      severity: 'error',
      message: 'Fiscal authority response did not include a recognized status field.',
      details: `Expected one of: ${keys.join(', ')}.`,
      raw: body,
    },
  };
}

function optionalBooleanValue(body: unknown, keys: string[]): boolean | undefined {
  const value = valueByKeys(body, keys);

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.toLowerCase();

    if (['1', 'sim', 'true', 'yes'].includes(normalized)) {
      return true;
    }

    if (['0', 'false', 'nao', 'não', 'no'].includes(normalized)) {
      return false;
    }
  }

  return undefined;
}

function textValue(body: unknown, keys: string[]): string | undefined {
  const value = valueByKeys(body, keys);

  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

function arrayValue(body: unknown, keys: string[]): unknown[] {
  const value = valueByKeys(body, keys);

  return Array.isArray(value) ? value : [];
}

function valueByKeys(body: unknown, keys: string[]): unknown {
  if (!isRecord(body)) {
    return undefined;
  }

  for (const key of keys) {
    if (body[key] !== undefined) {
      return body[key];
    }
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function defaultFetch(): FiscalAuthorityFetch {
  if (typeof globalThis.fetch !== 'function') {
    throw new EfaturaValidationError(
      'fetch',
      'A fetch implementation is required for fiscal authority validation.',
      'fiscal_authority.fetch_required',
    );
  }

  return globalThis.fetch.bind(globalThis);
}
