import { describe, expect, it } from 'vitest';
import { DocumentType } from '../src/domain/enums/document-type';
import { EfaturaValidationError } from '../src/domain/errors';
import { transportDocumentDataFrom } from '../src/domain/value-objects/documents';
import { paymentsDataFrom } from '../src/domain/value-objects/payment-structures';
import { quantityDataFrom } from '../src/domain/value-objects/quantity-data';
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

describe('coded value validation', () => {
  it('rejects payment means codes outside the UNECE D19B list', () => {
    expect(() =>
      paymentsDataFrom({
        payments: [
          { paymentMeansCode: '31', paymentAmount: 1000 },
          { paymentMeansCode: 'ZZZ', paymentAmount: 1000 },
        ],
      }),
    ).not.toThrow();

    expectValidation(
      () => paymentsDataFrom({ payments: [{ paymentMeansCode: '73', paymentAmount: 1000 }] }),
      'payments.payments.0.paymentMeansCode',
      'Payments are invalid.',
    );
  });

  it('rejects quantity unit codes outside the local XSD format', () => {
    expect(quantityDataFrom({ value: 1, unitCode: 'EA' }).unitCode).toBe('EA');
    expect(quantityDataFrom({ value: 1, unitCode: 'CODE_1' }).unitCode).toBe('CODE_1');

    expectValidation(
      () => quantityDataFrom({ value: 1, unitCode: 'EA-1' }),
      'quantity.unitCode',
      'Quantity is invalid.',
    );

    expectValidation(
      () => quantityDataFrom({ value: 1, unitCode: 'ABCDEFGHIJK' }),
      'quantity.unitCode',
      'Quantity is invalid.',
    );
  });

  it('rejects transport document codes outside their fixed ranges', () => {
    expectValidation(
      () => transportDocumentDataFrom({ invoice: transportPayload({ receiverTypeCode: '4' }) }),
      'invoice.receiverTypeCode',
      'ReceiverTypeCode must be between 1 and 3.',
    );

    expectValidation(
      () =>
        transportDocumentDataFrom({
          invoice: transportPayload({ transportDocumentTypeCode: '6' }),
        }),
      'invoice.transportDocumentTypeCode',
      'TransportDocumentTypeCode must be between 1 and 5.',
    );

    expectValidation(
      () =>
        transportDocumentDataFrom({
          invoice: transportPayload({
            transportRoute: {
              locations: [
                {
                  address: { countryCode: 'CV', addressDetail: 'Origem' },
                  duration: { startDate: '2026-02-08', startTime: '10:30:00' },
                  transportModeCode: '9',
                },
                {
                  address: { countryCode: 'CV', addressDetail: 'Destino' },
                  duration: { startDate: '2026-02-08', startTime: '11:30:00' },
                  transportModeCode: '1',
                },
              ],
            },
          }),
        }),
      'transportRoute.locations.0.transportModeCode',
      'TransportRoute is invalid.',
    );
  });
});

function transportPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return baseInvoicePayload({
    type: DocumentType.ElectronicTransportDocument,
    receiver: null,
    receiverTypeCode: '1',
    transportDocumentTypeCode: '1',
    transportServiceProviderParty: baseInvoicePayload().emitter,
    transportRoute: transportRoutePayload(),
    totals: undefined,
    ...overrides,
  });
}
