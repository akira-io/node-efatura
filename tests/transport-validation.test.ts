import { describe, expect, it } from 'vitest';
import { DocumentType } from '../src/domain/enums/document-type';
import { EfaturaValidationError } from '../src/domain/errors';
import { transportDocumentDataFrom } from '../src/domain/value-objects/documents';
import { baseInvoicePayload, transportRoutePayload } from './helpers';

function expectValidation(callback: () => unknown, field: string, message: string): void {
  try {
    callback();
    throw new Error('Expected validation to fail.');
  } catch (error) {
    expect(error).toBeInstanceOf(EfaturaValidationError);
    const validationError = error as EfaturaValidationError;
    expect(validationError.field).toBe(field);
    expect(validationError.message).toBe(message);
  }
}

describe('transport document validation', () => {
  it('rejects totals on transport documents', () => {
    const payload = baseInvoicePayload({
      type: DocumentType.ElectronicTransportDocument,
      receiver: null,
      transportDocumentTypeCode: '1',
      transportServiceProviderParty: baseInvoicePayload().emitter,
      transportRoute: transportRoutePayload(),
    });

    expectValidation(
      () => transportDocumentDataFrom({ invoice: payload }),
      'totals',
      'totals is not allowed for this document type.',
    );
  });
});
