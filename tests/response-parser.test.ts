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
      '<ns:Response xmlns:ns="urn:test"><ns:Dfe><ns:Id>CV123</ns:Id><ns:Status>REJECTED</ns:Status></ns:Dfe><ns:Error><ns:Code>E2</ns:Code><ns:Message>Rejected</ns:Message></ns:Error></ns:Response>',
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

  it('normalizes Portuguese response fields from PE and middleware payloads', () => {
    const body = {
      Resposta: {
        IdPedido: 'REQ-1',
        IdCorrelacao: 'COR-1',
        DataRececao: '2026-02-08T11:30:00Z',
        Documentos: [
          {
            IUD: 'CV123',
            Estado: 'ACEITE',
            Codigo: '200',
            Mensagem: 'Documento aceite',
            CodigoAutorizacao: 'AUTH-1',
            CodigoValidacao: 'VAL-1',
          },
        ],
        Erros: [
          {
            Codigo: 'VAL001',
            Mensagem: 'Campo invalido',
            Campo: 'Dfe.Invoice.Tax',
            Severidade: 'Erro',
            Detalhes: 'TaxExemptionReasonCode em falta',
          },
        ],
      },
    };
    const result = normalizePlatformSubmissionResult({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      rawBody: JSON.stringify(body),
      body,
    });

    expect(result).toMatchObject({
      requestId: 'REQ-1',
      correlationId: 'COR-1',
      receivedAt: '2026-02-08T11:30:00Z',
    });
    expect(result.documents[0]).toMatchObject({
      iud: 'CV123',
      status: 'ACEITE',
      authorizationCode: 'AUTH-1',
      validationCode: 'VAL-1',
    });
    expect(result.errors[0]).toMatchObject({
      code: 'VAL001',
      field: 'Dfe.Invoice.Tax',
      severity: 'Erro',
      details: 'TaxExemptionReasonCode em falta',
    });
  });
});
