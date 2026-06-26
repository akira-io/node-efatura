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

  if (wrapped.invoice.totals.grandTotal >= 20000 && wrapped.invoice.receiver === null) {
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
  return wrapInvoice(data, DocumentType.ElectronicReceipt, options);
}

export function creditNoteDataFrom(
  data: Record<string, unknown>,
  options: WrapperValidationOptions = {},
): WrappedInvoiceData {
  if (!isRecord(data.invoice)) {
    throw new EfaturaValidationError(
      'invoice',
      messages.validation.invoiceRequired,
      'validation.invoice_required',
    );
  }

  if (data.invoice.originalIud == null || data.invoice.originalIud === '') {
    throw new EfaturaValidationError(
      'invoice.originalIud',
      messages.invoice.originalIudRequired,
      'invoice.original_iud_required',
    );
  }

  if (data.invoice.creditNoteReason == null || data.invoice.creditNoteReason === '') {
    throw new EfaturaValidationError(
      'invoice.creditNoteReason',
      messages.invoice.creditNoteReasonRequired,
      'invoice.credit_note_reason_required',
    );
  }

  return wrapInvoice(data, DocumentType.ElectronicCreditNote, options);
}

export function debitNoteDataFrom(
  data: Record<string, unknown>,
  options: WrapperValidationOptions = {},
): WrappedInvoiceData {
  return wrapInvoice(data, DocumentType.ElectronicDebitNote, options);
}

export function transportDocumentDataFrom(
  data: Record<string, unknown>,
  options: WrapperValidationOptions = {},
): WrappedInvoiceData {
  return wrapInvoice(data, DocumentType.ElectronicTransportDocument, options);
}

export function returnNoteDataFrom(
  data: Record<string, unknown>,
  options: WrapperValidationOptions = {},
): WrappedInvoiceData {
  return wrapInvoice(data, DocumentType.ElectronicReturnNote, options);
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
