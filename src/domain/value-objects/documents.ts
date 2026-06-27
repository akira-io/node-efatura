import type { DocumentTypePolicy } from '../../core/contracts/document-type-policy';
import { messages } from '../../support/messages';
import { isRecord } from '../../support/normalizers';
import { DocumentType } from '../enums/document-type';
import { EfaturaValidationError } from '../errors';
import { type InvoiceData, invoiceDataFrom } from './invoice-data';

export interface WrappedInvoiceData {
  invoice: InvoiceData;
}

export interface WrapperValidationOptions {
  documentTypePolicy?: DocumentTypePolicy;
}

export function electronicInvoiceDataFrom(
  data: Record<string, unknown>,
  options: WrapperValidationOptions = {},
): WrappedInvoiceData {
  return wrapInvoice(data, DocumentType.ElectronicInvoice, options);
}

export function receiptInvoiceDataFrom(
  data: Record<string, unknown>,
  options: WrapperValidationOptions = {},
): WrappedInvoiceData {
  return wrapInvoice(data, DocumentType.ElectronicInvoiceReceipt, options);
}

export function salesReceiptDataFrom(
  data: Record<string, unknown>,
  options: WrapperValidationOptions = {},
): WrappedInvoiceData {
  const wrapped = wrapInvoice(data, DocumentType.ElectronicSalesTicket, options);

  if ((wrapped.invoice.totals?.payableAmount ?? 0) >= 20000 && wrapped.invoice.receiver === null) {
    throw new EfaturaValidationError(
      'invoice.receiver',
      messages.invoice.receiverRequiredForType,
      'invoice.receiver_required_for_type',
    );
  }

  return wrapped;
}

export function electronicReceiptDataFrom(
  data: Record<string, unknown>,
  options: WrapperValidationOptions = {},
): WrappedInvoiceData {
  const wrapped = wrapInvoice(data, DocumentType.ElectronicReceipt, options);

  assertReceipt(wrapped.invoice);

  return wrapped;
}

export function creditNoteDataFrom(
  data: Record<string, unknown>,
  options: WrapperValidationOptions = {},
): WrappedInvoiceData {
  const wrapped = wrapInvoice(data, DocumentType.ElectronicCreditNote, options);

  assertCorrectiveDocument(wrapped.invoice);

  return wrapped;
}

export function debitNoteDataFrom(
  data: Record<string, unknown>,
  options: WrapperValidationOptions = {},
): WrappedInvoiceData {
  const wrapped = wrapInvoice(data, DocumentType.ElectronicDebitNote, options);

  assertCorrectiveDocument(wrapped.invoice);

  return wrapped;
}

export function transportDocumentDataFrom(
  data: Record<string, unknown>,
  options: WrapperValidationOptions = {},
): WrappedInvoiceData {
  const wrapped = wrapInvoice(data, DocumentType.ElectronicTransportDocument, options);

  if (!wrapped.invoice.transportDocumentTypeCode) {
    throw new EfaturaValidationError(
      'invoice.transportDocumentTypeCode',
      'TransportDocumentTypeCode is required for transport documents.',
      'invoice.transport_document_type_code_required',
    );
  }

  if (!wrapped.invoice.transportServiceProviderParty) {
    throw new EfaturaValidationError(
      'invoice.transportServiceProviderParty',
      'TransportServiceProviderParty is required for transport documents.',
      'invoice.transport_service_provider_required',
    );
  }

  if (!wrapped.invoice.transportRoute) {
    throw new EfaturaValidationError(
      'invoice.transportRoute',
      'TransportRoute is required for transport documents.',
      'invoice.transport_route_required',
    );
  }

  if (
    wrapped.invoice.receiverTypeCode !== null &&
    !['1', '2', '3'].includes(wrapped.invoice.receiverTypeCode)
  ) {
    throw new EfaturaValidationError(
      'invoice.receiverTypeCode',
      'ReceiverTypeCode must be between 1 and 3.',
      'invoice.receiver_type_code_invalid',
    );
  }

  if (!['1', '2', '3', '4', '5'].includes(wrapped.invoice.transportDocumentTypeCode)) {
    throw new EfaturaValidationError(
      'invoice.transportDocumentTypeCode',
      'TransportDocumentTypeCode must be between 1 and 5.',
      'invoice.transport_document_type_code_invalid',
    );
  }

  if (
    wrapped.invoice.transportDocumentTypeCode === '5' &&
    wrapped.invoice.references.length === 0
  ) {
    throw new EfaturaValidationError(
      'invoice.references',
      'References are required for customer return transport documents.',
      'invoice.references_required',
    );
  }

  return wrapped;
}

export function returnNoteDataFrom(
  data: Record<string, unknown>,
  options: WrapperValidationOptions = {},
): WrappedInvoiceData {
  const wrapped = wrapInvoice(data, DocumentType.ElectronicReturnNote, options);

  assertCorrectiveDocument(wrapped.invoice);

  return wrapped;
}

export function entryNoteDataFrom(
  data: Record<string, unknown>,
  options: WrapperValidationOptions = {},
): WrappedInvoiceData {
  return wrapInvoice(data, DocumentType.ElectronicEntryNote, options);
}

function wrapInvoice(
  data: Record<string, unknown>,
  expectedType: DocumentType,
  options: WrapperValidationOptions,
): WrappedInvoiceData {
  if (!isRecord(data.invoice)) {
    throw new EfaturaValidationError(
      'invoice',
      messages.validation.invoiceRequired,
      'validation.invoice_required',
    );
  }

  const invoice = invoiceDataFrom(data.invoice, options);

  if (invoice.type !== expectedType) {
    throw new EfaturaValidationError(
      'invoice.type',
      messages.validation.invoiceTypeMismatch,
      'validation.invoice_type_mismatch',
    );
  }

  return { invoice };
}

function assertCorrectiveDocument(invoice: InvoiceData): void {
  if (!invoice.issueReasonCode) {
    throw new EfaturaValidationError(
      'invoice.issueReasonCode',
      'IssueReasonCode is required for credit, debit, and return notes.',
      'invoice.issue_reason_code_required',
    );
  }

  assertIssueReasonAllowed(invoice);

  if (invoice.issueReasonCode === 'DRP' && invoice.rappelPeriod === null) {
    throw new EfaturaValidationError(
      'invoice.rappelPeriod',
      'RappelPeriod is required when IssueReasonCode is DRP.',
      'invoice.rappel_period_required',
    );
  }

  if (invoice.issueReasonCode !== 'IN' && invoice.references.length === 0) {
    throw new EfaturaValidationError(
      'invoice.references',
      'References are required for credit, debit, and return notes.',
      'invoice.references_required',
    );
  }
}

function assertReceipt(invoice: InvoiceData): void {
  if (!invoice.receiptTypeCode) {
    throw new EfaturaValidationError(
      'invoice.receiptTypeCode',
      'ReceiptTypeCode is required for receipts.',
      'invoice.receipt_type_code_required',
    );
  }

  if (!['1', '2', '3', '4'].includes(invoice.receiptTypeCode)) {
    throw new EfaturaValidationError(
      'invoice.receiptTypeCode',
      'ReceiptTypeCode must be between 1 and 4.',
      'invoice.receipt_type_code_invalid',
    );
  }

  if (invoice.receiptTypeCode === '4' && invoice.rentReceipt === null) {
    throw new EfaturaValidationError(
      'invoice.rentReceipt',
      'RentReceipt is required when ReceiptTypeCode is 4.',
      'invoice.rent_receipt_required',
    );
  }
}

function assertIssueReasonAllowed(invoice: InvoiceData): void {
  const allowed: Record<DocumentType, readonly string[]> = {
    [DocumentType.ElectronicInvoice]: [],
    [DocumentType.ElectronicInvoiceReceipt]: [],
    [DocumentType.ElectronicSalesTicket]: [],
    [DocumentType.ElectronicReceipt]: [],
    [DocumentType.ElectronicCreditNote]: ['2', '3', '6', '7', '8', '9', 'IN', 'DRP'],
    [DocumentType.ElectronicDebitNote]: ['2', '3', '4', '6', '8', '9', 'DD', 'IN'],
    [DocumentType.ElectronicTransportDocument]: [],
    [DocumentType.ElectronicReturnNote]: ['0', '2', '3', '6', '7', '8', '9', 'IN'],
    [DocumentType.ElectronicEntryNote]: [],
  };

  if (!allowed[invoice.type].includes(invoice.issueReasonCode ?? '')) {
    throw new EfaturaValidationError(
      'invoice.issueReasonCode',
      'IssueReasonCode is not allowed for this document type.',
      'invoice.issue_reason_code_invalid',
    );
  }
}
