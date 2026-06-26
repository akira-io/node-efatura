import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_TYPES,
  DocumentType,
  documentTypeCode,
  documentTypeFromCode,
  documentTypeIudCode,
} from '../src/domain/enums/document-type';
import { DefaultDocumentTypePolicy } from '../src/domain/policies/default-document-type-policy';

describe('document types', () => {
  it('includes all official document type codes', () => {
    expect([...DOCUMENT_TYPES].sort()).toEqual([
      'DTE',
      'DVE',
      'FRE',
      'FTE',
      'NCE',
      'NDE',
      'NLE',
      'RCE',
      'TVE',
    ]);
  });

  it('marks supported emission document types', () => {
    const policy = new DefaultDocumentTypePolicy();

    for (const type of DOCUMENT_TYPES) {
      expect(policy.supportsEmission(type)).toBe(true);
      expect(policy.allowsIud(type)).toBe(true);
      expect(policy.allowsXml(type)).toBe(true);
      expect(policy.allowedInProduction(type)).toBe(true);
    }
  });

  it('maps document types to numeric DFE codes', () => {
    expect(documentTypeCode(DocumentType.ElectronicInvoice)).toBe(1);
    expect(documentTypeIudCode(DocumentType.ElectronicInvoice)).toBe('01');
    expect(documentTypeCode(DocumentType.ElectronicEntryNote)).toBe(9);
    expect(documentTypeFromCode('5')).toBe(DocumentType.ElectronicCreditNote);
    expect(documentTypeFromCode(99)).toBeNull();
  });
});
