import type { DocumentTypePolicy } from '../../core/contracts/document-type-policy';
import { DOCUMENT_TYPES, type DocumentType } from '../enums/document-type';

const SUPPORTED_DOCUMENT_TYPES = new Set<DocumentType>(DOCUMENT_TYPES);

export class DefaultDocumentTypePolicy implements DocumentTypePolicy {
  supportsEmission(type: DocumentType): boolean {
    return SUPPORTED_DOCUMENT_TYPES.has(type);
  }

  allowsIud(type: DocumentType): boolean {
    return this.supportsEmission(type);
  }

  allowsXml(type: DocumentType): boolean {
    return this.supportsEmission(type);
  }

  allowedInProduction(type: DocumentType): boolean {
    return this.supportsEmission(type);
  }
}
