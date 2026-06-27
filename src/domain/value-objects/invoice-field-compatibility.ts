import { DocumentType } from '../enums/document-type';
import { EfaturaValidationError } from '../errors';
import type { InvoiceData } from './invoice-data';
import type { PaymentsData } from './payment-structures';

export function assertDocumentFieldCompatibility(invoice: InvoiceData): void {
  assertAllowed(invoice.dueDate === null, 'dueDate', invoice.type, [
    DocumentType.ElectronicInvoice,
  ]);
  assertAllowed(invoice.orderReferenceId === null, 'orderReferenceId', invoice.type, [
    DocumentType.ElectronicInvoice,
    DocumentType.ElectronicInvoiceReceipt,
  ]);
  assertAllowed(invoice.taxPointDate === null, 'taxPointDate', invoice.type, [
    DocumentType.ElectronicInvoice,
    DocumentType.ElectronicInvoiceReceipt,
  ]);
  assertAllowed(invoice.paymentParty === null, 'paymentParty', invoice.type, [
    DocumentType.ElectronicInvoiceReceipt,
    DocumentType.ElectronicReceipt,
    DocumentType.ElectronicEntryNote,
  ]);
  assertAllowed(invoice.lines.length === 0, 'lines', invoice.type, lineDocumentTypes);
  assertAllowed(invoice.totals === null, 'totals', invoice.type, totalsDocumentTypes);
  assertAllowed(invoice.delivery === null, 'delivery', invoice.type, [
    DocumentType.ElectronicInvoice,
    DocumentType.ElectronicInvoiceReceipt,
    DocumentType.ElectronicSalesTicket,
  ]);
  assertAllowed(invoice.receiptTypeCode === null, 'receiptTypeCode', invoice.type, [
    DocumentType.ElectronicReceipt,
  ]);
  assertAllowed(invoice.rentReceipt === null, 'rentReceipt', invoice.type, [
    DocumentType.ElectronicReceipt,
  ]);
  assertAllowed(invoice.rappelPeriod === null, 'rappelPeriod', invoice.type, [
    DocumentType.ElectronicCreditNote,
  ]);
  assertAllowed(invoice.issueReasonCode === null, 'issueReasonCode', invoice.type, correctiveTypes);
  assertAllowed(invoice.issueReasonDescription === null, 'issueReasonDescription', invoice.type, [
    DocumentType.ElectronicReturnNote,
  ]);
  assertAllowed(invoice.receiverTypeCode === null, 'receiverTypeCode', invoice.type, [
    DocumentType.ElectronicTransportDocument,
  ]);
  assertAllowed(
    invoice.transportDocumentTypeCode === null,
    'transportDocumentTypeCode',
    invoice.type,
    [DocumentType.ElectronicTransportDocument],
  );
  assertAllowed(
    invoice.transportServiceProviderParty === null,
    'transportServiceProviderParty',
    invoice.type,
    [DocumentType.ElectronicTransportDocument],
  );
  assertAllowed(invoice.transportRoute === null, 'transportRoute', invoice.type, [
    DocumentType.ElectronicTransportDocument,
  ]);
  assertAllowed(
    invoice.references.length === 0,
    'references',
    invoice.type,
    referenceDocumentTypes,
  );
  assertAllowed(
    !hasPaymentsContent(invoice.payments),
    'payments',
    invoice.type,
    paymentDocumentTypes,
  );
}

const lineDocumentTypes = [
  DocumentType.ElectronicInvoice,
  DocumentType.ElectronicInvoiceReceipt,
  DocumentType.ElectronicSalesTicket,
  DocumentType.ElectronicCreditNote,
  DocumentType.ElectronicDebitNote,
  DocumentType.ElectronicTransportDocument,
  DocumentType.ElectronicReturnNote,
  DocumentType.ElectronicEntryNote,
] as const;

const totalsDocumentTypes = [
  DocumentType.ElectronicInvoice,
  DocumentType.ElectronicInvoiceReceipt,
  DocumentType.ElectronicSalesTicket,
  DocumentType.ElectronicCreditNote,
  DocumentType.ElectronicDebitNote,
  DocumentType.ElectronicReturnNote,
  DocumentType.ElectronicEntryNote,
] as const;

const correctiveTypes = [
  DocumentType.ElectronicCreditNote,
  DocumentType.ElectronicDebitNote,
  DocumentType.ElectronicReturnNote,
] as const;

const referenceDocumentTypes = [
  DocumentType.ElectronicInvoice,
  DocumentType.ElectronicInvoiceReceipt,
  DocumentType.ElectronicReceipt,
  DocumentType.ElectronicCreditNote,
  DocumentType.ElectronicDebitNote,
  DocumentType.ElectronicTransportDocument,
  DocumentType.ElectronicReturnNote,
  DocumentType.ElectronicEntryNote,
] as const;

const paymentDocumentTypes = [
  DocumentType.ElectronicInvoice,
  DocumentType.ElectronicInvoiceReceipt,
  DocumentType.ElectronicSalesTicket,
  DocumentType.ElectronicReceipt,
  DocumentType.ElectronicEntryNote,
] as const;

function assertAllowed(
  empty: boolean,
  fieldName: string,
  type: DocumentType,
  allowedTypes: readonly DocumentType[],
): void {
  if (empty || allowedTypes.includes(type)) {
    return;
  }

  throw new EfaturaValidationError(
    fieldName,
    `${fieldName} is not allowed for this document type.`,
    'invoice.field_not_allowed',
  );
}

function hasPaymentsContent(payments: PaymentsData | null): boolean {
  return (
    payments !== null &&
    (payments.paymentDueDate !== null ||
      payments.paymentTermsNote !== null ||
      payments.payeeFinancialAccounts.length > 0 ||
      payments.payments.length > 0)
  );
}
