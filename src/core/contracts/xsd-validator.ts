import type { DocumentType } from '../../domain/enums/document-type';

export interface XsdValidationContext {
  documentType: DocumentType;
  schemaVersion: string;
}

export interface XsdValidationIssue {
  message: string;
  code?: string;
  path?: string;
  line?: number;
  column?: number;
}

export interface XsdValidationResult {
  valid: boolean;
  errors: XsdValidationIssue[];
  warnings?: XsdValidationIssue[];
}

export interface XsdValidator {
  validate(xml: string, context: XsdValidationContext): Promise<XsdValidationResult>;
}
