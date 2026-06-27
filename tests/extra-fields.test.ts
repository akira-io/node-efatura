import { describe, expect, it } from 'vitest';
import { EfaturaValidationError } from '../src/domain/errors';
import { invoiceDataFrom } from '../src/domain/value-objects/invoice-data';
import { baseInvoicePayload } from './helpers';

describe('extra fields', () => {
  it('rejects official XML fields passed through ExtraFields', () => {
    expectValidation(
      () =>
        invoiceDataFrom(
          baseInvoicePayload({
            extraFields: [{ name: 'TaxId', value: '100200300' }],
          }),
        ),
      'extraFields.0.name',
      'TaxId is an official XML field and must use its first-class schema.',
    );

    expectValidation(
      () =>
        invoiceDataFrom(
          baseInvoicePayload({
            extraFields: { Payments: { Payment: { PaymentAmount: 1000 } } },
          }),
        ),
      'extraFields.0.name',
      'Payments is an official XML field and must use its first-class schema.',
    );
  });
});

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
