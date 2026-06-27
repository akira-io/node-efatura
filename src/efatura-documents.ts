import { InvoiceBuilder } from './application/builders/invoice-builder';
import type { ResolvedEfaturaConfig } from './config';
import type { DocumentTypePolicy } from './core/contracts/document-type-policy';
import {
  creditNoteDataFrom,
  debitNoteDataFrom,
  electronicInvoiceDataFrom,
  electronicReceiptDataFrom,
  entryNoteDataFrom,
  receiptInvoiceDataFrom,
  returnNoteDataFrom,
  salesReceiptDataFrom,
  transportDocumentDataFrom,
  type WrappedInvoiceData,
} from './domain/value-objects/documents';
import { type InvoiceData, invoiceDataFrom } from './domain/value-objects/invoice-data';

export class EfaturaDocuments {
  constructor(
    readonly config: ResolvedEfaturaConfig,
    readonly documentTypePolicy: DocumentTypePolicy,
  ) {}

  invoice(): InvoiceBuilder {
    return new InvoiceBuilder(
      (data) => this.validateInvoice(data),
      () => this.generateDocumentId(),
    );
  }

  validateInvoice(data: Record<string, unknown>): InvoiceData {
    return invoiceDataFrom(data, { documentTypePolicy: this.documentTypePolicy });
  }

  electronicInvoice(data: Record<string, unknown>): WrappedInvoiceData {
    return electronicInvoiceDataFrom(data, { documentTypePolicy: this.documentTypePolicy });
  }

  receiptInvoice(data: Record<string, unknown>): WrappedInvoiceData {
    return receiptInvoiceDataFrom(data, { documentTypePolicy: this.documentTypePolicy });
  }

  salesReceipt(data: Record<string, unknown>): WrappedInvoiceData {
    return salesReceiptDataFrom(data, { documentTypePolicy: this.documentTypePolicy });
  }

  electronicReceipt(data: Record<string, unknown>): WrappedInvoiceData {
    return electronicReceiptDataFrom(data, { documentTypePolicy: this.documentTypePolicy });
  }

  creditNote(data: Record<string, unknown>): WrappedInvoiceData {
    return creditNoteDataFrom(data, { documentTypePolicy: this.documentTypePolicy });
  }

  debitNote(data: Record<string, unknown>): WrappedInvoiceData {
    return debitNoteDataFrom(data, { documentTypePolicy: this.documentTypePolicy });
  }

  transportDocument(data: Record<string, unknown>): WrappedInvoiceData {
    return transportDocumentDataFrom(data, { documentTypePolicy: this.documentTypePolicy });
  }

  returnNote(data: Record<string, unknown>): WrappedInvoiceData {
    return returnNoteDataFrom(data, { documentTypePolicy: this.documentTypePolicy });
  }

  entryNote(data: Record<string, unknown>): WrappedInvoiceData {
    return entryNoteDataFrom(data, { documentTypePolicy: this.documentTypePolicy });
  }

  generateDocumentId(): string {
    return this.config.generators.documentId();
  }
}
