import type { MiddlewareSubmissionError, MiddlewareSubmissionResult } from '../../core/contracts';

export function parseServiceBody(body: string, contentType = ''): unknown {
  const trimmed = body.trim();

  if (trimmed === '') {
    return null;
  }

  if (contentType.includes('json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return body;
    }
  }

  return body;
}

export function normalizeSubmissionResult(input: {
  ok: boolean;
  status: number;
  statusText: string;
  rawBody: string;
  body: unknown;
}): MiddlewareSubmissionResult {
  return {
    ...input,
    documents: extractDocuments(input.body),
    errors: extractErrors(input.body),
  };
}

function extractDocuments(body: unknown): MiddlewareSubmissionResult['documents'] {
  if (!isRecord(body)) {
    return [];
  }

  const candidates = [body.documents, body.dfe, body.dfes, body.results].find(Array.isArray);

  if (!Array.isArray(candidates)) {
    return [];
  }

  return candidates.filter(isRecord).map((item) => ({
    iud: asText(item.iud ?? item.IUD ?? item.id ?? item.Id),
    status: asText(item.status ?? item.Status),
    code: asText(item.code ?? item.Code),
    message: asText(item.message ?? item.Message),
    raw: item,
  }));
}

function extractErrors(body: unknown): MiddlewareSubmissionError[] {
  if (!isRecord(body)) {
    return [];
  }

  const candidates = [body.errors, body.error, body.validationErrors].find(
    (value) => value != null,
  );
  const list = Array.isArray(candidates) ? candidates : candidates ? [candidates] : [];

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
