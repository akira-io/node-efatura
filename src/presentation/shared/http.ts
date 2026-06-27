import { EfaturaValidationError } from '../../domain/errors';
import type { Efatura } from '../../efatura';
import { isRecord } from '../../support/normalizers';
import {
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
