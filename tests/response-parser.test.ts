import { describe, expect, it } from 'vitest';
import {
  normalizePlatformSubmissionResult,
  normalizeSubmissionResult,
  parseServiceBody,
} from '../src/infrastructure';

describe('service response parser', () => {
  it('normalizes middleware JSON documents and errors', () => {
    const body = {
      documents: [{ IUD: 'CV123', Status: 'ACCEPTED', Code: '200', Message: 'Accepted' }],
      errors: [{ Code: 'E001', Message: 'Invalid tax', Field: 'Tax' }],
    };
    const result = normalizeSubmissionResult({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      rawBody: JSON.stringify(body),
      body,
    });

    expect(result.documents[0]).toMatchObject({
      iud: 'CV123',
      status: 'ACCEPTED',
      code: '200',
      message: 'Accepted',
    });
    expect(result.errors[0]).toMatchObject({
      code: 'E001',
      field: 'Tax',
      message: 'Invalid tax',
    });
  });

  it('parses XML service bodies and normalizes platform results', () => {
    const body = parseServiceBody(
      '<Response><Dfe><Id>CV123</Id><Status>REJECTED</Status></Dfe><Error><Code>E2</Code><Message>Rejected</Message></Error></Response>',
      'application/xml',
    );
    const result = normalizePlatformSubmissionResult({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      rawBody: '',
      body,
    });

    expect(result.documents[0]).toMatchObject({ iud: 'CV123', status: 'REJECTED' });
    expect(result.errors[0]).toMatchObject({ code: 'E2', message: 'Rejected' });
  });

  it('adds an HTTP error when the service fails without a structured error payload', () => {
    const result = normalizeSubmissionResult({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      rawBody: 'oops',
      body: 'oops',
    });

    expect(result.errors).toEqual([{ code: '500', message: 'Server Error' }]);
  });
});
