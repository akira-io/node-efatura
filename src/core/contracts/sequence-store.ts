import type { DocumentType } from '../../domain/enums/document-type';

export interface SequenceScope {
  nif: string;
  year: number;
  led: string;
  documentType: DocumentType;
}

export interface SequenceStore {
  next(scope: SequenceScope): Promise<number>;
  current?(scope: SequenceScope): Promise<number | null>;
  reset?(scope: SequenceScope): Promise<void>;
}

export function sequenceScopeKey(scope: SequenceScope): string {
  return [scope.nif, scope.year, scope.led, scope.documentType].join(':');
}
