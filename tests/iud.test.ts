import { describe, expect, it } from 'vitest';
import { DocumentType } from '../src/domain/enums/document-type';
import { EfaturaValidationError } from '../src/domain/errors';
import { buildIud, parseIud, validateIud } from '../src/domain/iud/iud';
import { calculateLuhnCheckDigit, validateLuhn } from '../src/domain/iud/luhn';

describe('IUD', () => {
  it('calculates Luhn check digits', () => {
    expect(calculateLuhnCheckDigit('326020810020030000123010000000011234567890')).toBe('9');
    expect(validateLuhn('3260208100200300001230100000000112345678909')).toBe(true);
  });

  it('builds and parses 45-character IUDs', () => {
    const iud = buildIud({
      repositoryCode: 3,
      issueDate: '2026-02-08',
      emitterNif: '100200300',
      led: '123',
      documentType: DocumentType.ElectronicInvoice,
      documentNumber: 1,
      randomCode: '1234567890',
    });

    expect(iud).toBe('CV3260208100200300001230100000000112345678909');
    expect(iud).toHaveLength(45);
    expect(validateIud(iud)).toBe(true);
    expect(parseIud(iud)).toMatchObject({
      country: 'CV',
      repositoryCode: 3,
      issueDate: '2026-02-08',
      emitterNif: '100200300',
      led: '00123',
      documentTypeCode: '01',
      documentNumber: '000000001',
      randomCode: '1234567890',
      checkDigit: '9',
    });
  });

  it('rejects invalid IUD inputs', () => {
    expect(validateIud('CV3260208100200300001230100000000112345678900')).toBe(false);
    expect(() =>
      buildIud({
        repositoryCode: 3,
        issueDate: '2026-02-31',
        emitterNif: '100200300',
        led: '123',
        documentType: 1,
        documentNumber: 1,
        randomCode: '1234567890',
      }),
    ).toThrow(EfaturaValidationError);
  });
});
