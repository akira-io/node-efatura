import { warnRenderDfaCurrencyDeprecation } from '../../application/dfa/render-dfa-currency-deprecation';
import { EfaturaValidationError } from '../../domain/errors';
import type { Efatura } from '../../efatura';
import { isRecord } from '../../support/normalizers';
import {
  dfaRenderRequestSchema,
  dfeXmlRequestSchema,
  dfeZipRequestSchema,
  eventXmlRequestSchema,
  fiscalReadinessRequestSchema,
} from './schemas';

export interface HttpResult {
  status: number;
  headers?: Record<string, string>;
  body: unknown;
}

export async function handleBuildXml(efatura: Efatura, body: unknown): Promise<HttpResult> {
  const payload = parseRequest(body, dfeXmlRequestSchema, 'body');
  const xml = efatura.buildDfeXml(payload.invoice, payload.options);

  return { status: 200, body: { xml } };
}

export async function handleBuildEventXml(efatura: Efatura, body: unknown): Promise<HttpResult> {
  const payload = parseRequest(body, eventXmlRequestSchema, 'body');
  const xml = efatura.buildEventXml(payload.event, payload.options);

  return { status: 200, body: { xml } };
}

export async function handleBuildZip(efatura: Efatura, body: unknown): Promise<HttpResult> {
  const payload = parseRequest(body, dfeZipRequestSchema, 'body');
  const zip = efatura.buildDfeZip(payload.files);

  return {
    status: 200,
    headers: {
      'content-type': 'application/zip',
      'content-disposition': 'attachment; filename="dfe.zip"',
    },
    body: zip,
  };
}

export async function handleSubmitMiddleware(efatura: Efatura, body: unknown): Promise<HttpResult> {
  const zip = await zipFromBody(efatura, body);
  const result = await efatura.submitDfeZip(zip);

  return { status: result.status, body: result };
}

export async function handleFiscalReadiness(efatura: Efatura, body: unknown): Promise<HttpResult> {
  const payload = parseRequest(body, fiscalReadinessRequestSchema, 'body');
  const result = await efatura.validateFiscalReadiness(payload.invoice, payload.options);

  return { status: result.ok ? 200 : 422, body: result };
}

export async function handleRenderDfa(efatura: Efatura, iud: string): Promise<HttpResult> {
  const document = await efatura.renderDfa({ iud });

  return dfaDocumentResult(document);
}

export async function handleRenderDfaFromBody(
  efatura: Efatura,
  body: unknown,
): Promise<HttpResult> {
  warnRenderDfaCurrencyDeprecation(deprecatedDfaCurrencyFromBody(body));

  const payload = parseRequest(body, dfaRenderRequestSchema, 'body');
  const invoice = payload.invoice ? efatura.validateInvoice(payload.invoice) : undefined;
  const document = await efatura.renderDfa({
    iud: payload.iud,
    invoice,
    emissionMode: payload.options.emissionMode,
    contingencyIuc: payload.options.contingencyIuc,
    title: payload.options.title,
    currency: payload.options.currency,
  });

  return dfaDocumentResult(document);
}

function deprecatedDfaCurrencyFromBody(body: unknown): unknown {
  try {
    if (!isRecord(body)) {
      return undefined;
    }

    const optionsDescriptor = Object.getOwnPropertyDescriptor(body, 'options');

    if (
      optionsDescriptor === undefined ||
      !('value' in optionsDescriptor) ||
      !isRecord(optionsDescriptor.value)
    ) {
      return undefined;
    }

    const currencyDescriptor = Object.getOwnPropertyDescriptor(optionsDescriptor.value, 'currency');

    if (currencyDescriptor === undefined) {
      return undefined;
    }

    return 'value' in currencyDescriptor ? currencyDescriptor.value : true;
  } catch {
    return undefined;
  }
}

function dfaDocumentResult(document: Awaited<ReturnType<Efatura['renderDfa']>>): HttpResult {
  return {
    status: 200,
    headers: {
      'content-type': document.contentType,
      'content-disposition': `inline; filename="${document.filename}"`,
    },
    body: document.buffer,
  };
}

async function zipFromBody(efatura: Efatura, body: unknown): Promise<Buffer> {
  if (isRecord(body) && Buffer.isBuffer(body.zip)) {
    return body.zip;
  }

  const payload = parseRequest(body, dfeZipRequestSchema, 'body');

  return efatura.buildDfeZip(payload.files);
}

function parseRequest<T>(
  body: unknown,
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
  field: string,
): T {
  const result = schema.safeParse(body);

  if (!result.success) {
    throw new EfaturaValidationError(field, 'Request body is invalid.', 'http.body_invalid');
  }

  return result.data;
}
