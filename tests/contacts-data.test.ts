import { describe, expect, it } from 'vitest';
import { EfaturaValidationError } from '../src/domain/errors';
import { contactsDataFrom } from '../src/domain/value-objects/contacts-data';

function expectContactsValidation(callback: () => unknown, field: string): void {
  try {
    callback();
    throw new Error('Expected validation to fail.');
  } catch (error) {
    expect(error).toBeInstanceOf(EfaturaValidationError);
    const validationError = error as EfaturaValidationError;
    expect(validationError.field).toBe(field);
    expect(validationError.message).toBe('Contacts are invalid.');
  }
}

describe('contacts data', () => {
  it('requires phone fields to contain 7 to 20 digits', () => {
    expectContactsValidation(() => contactsDataFrom({ telephone: '123456' }), 'contacts.telephone');

    expectContactsValidation(
      () => contactsDataFrom({ mobilephone: '123456789012345678901' }),
      'contacts.mobilephone',
    );

    expect(contactsDataFrom({ telephone: '1234567' })?.telephone).toBe('1234567');
    expect(contactsDataFrom({ mobilephone: '12345678901234567890' })?.mobilephone).toBe(
      '12345678901234567890',
    );
  });
});
