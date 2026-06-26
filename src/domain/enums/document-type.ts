export const DocumentType = {
  ElectronicInvoice: 'FTE',
  ElectronicInvoiceReceipt: 'FRE',
  ElectronicSalesTicket: 'TVE',
  ElectronicReceipt: 'RCE',
  ElectronicCreditNote: 'NCE',
  ElectronicDebitNote: 'NDE',
  ElectronicTransportDocument: 'DTE',
  ElectronicReturnNote: 'DVE',
  ElectronicEntryNote: 'NLE',
} as const;

export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const DOCUMENT_TYPES = Object.values(DocumentType) as readonly DocumentType[];

const DOCUMENT_TYPE_CODES: Record<DocumentType, number> = {
  [DocumentType.ElectronicInvoice]: 1,
  [DocumentType.ElectronicInvoiceReceipt]: 2,
  [DocumentType.ElectronicSalesTicket]: 3,
  [DocumentType.ElectronicReceipt]: 4,
  [DocumentType.ElectronicCreditNote]: 5,
  [DocumentType.ElectronicDebitNote]: 6,
  [DocumentType.ElectronicTransportDocument]: 7,
  [DocumentType.ElectronicReturnNote]: 8,
  [DocumentType.ElectronicEntryNote]: 9,
};

export function documentTypeFromValue(value: unknown): DocumentType | null {
  if (typeof value !== 'string') {
    return null;
  }

  return isDocumentType(value) ? value : null;
}

export function documentTypeFromCode(value: unknown): DocumentType | null {
  const code = typeof value === 'number' ? value : Number(value);

  if (!Number.isInteger(code)) {
    return null;
  }

  for (const [type, typeCode] of Object.entries(DOCUMENT_TYPE_CODES)) {
    if (typeCode === code) {
      return type as DocumentType;
    }
  }

  return null;
}

export function documentTypeCode(type: DocumentType): number {
  return DOCUMENT_TYPE_CODES[type];
}

export function documentTypeIudCode(type: DocumentType): string {
  return String(documentTypeCode(type)).padStart(2, '0');
}

export function isDocumentType(value: string): value is DocumentType {
  return (DOCUMENT_TYPES as readonly string[]).includes(value);
}
