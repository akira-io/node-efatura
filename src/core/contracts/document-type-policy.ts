import type { DocumentType } from '../../domain/enums/document-type';

export interface DocumentTypePolicy {
  supportsEmission(type: DocumentType): boolean;
  allowsIud(type: DocumentType): boolean;
  allowsXml(type: DocumentType): boolean;
  allowedInProduction(type: DocumentType): boolean;
}
