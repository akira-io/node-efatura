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
      this.config.emitter === null ? {} : { emitter: this.config.emitter },
    );
  }

  validateInvoice(data: Record<string, unknown>): InvoiceData {
    return invoiceDataFrom(this.withConfiguredEmitter(data), {
      documentTypePolicy: this.documentTypePolicy,
    });
  }

  electronicInvoice(data: Record<string, unknown>): WrappedInvoiceData {
    return electronicInvoiceDataFrom(this.withConfiguredEmitter(data), {
      documentTypePolicy: this.documentTypePolicy,
    });
  }

  receiptInvoice(data: Record<string, unknown>): WrappedInvoiceData {
    return receiptInvoiceDataFrom(this.withConfiguredEmitter(data), {
      documentTypePolicy: this.documentTypePolicy,
    });
  }

  salesReceipt(data: Record<string, unknown>): WrappedInvoiceData {
    return salesReceiptDataFrom(this.withConfiguredEmitter(data), {
      documentTypePolicy: this.documentTypePolicy,
    });
  }

  electronicReceipt(data: Record<string, unknown>): WrappedInvoiceData {
    return electronicReceiptDataFrom(this.withConfiguredEmitter(data), {
      documentTypePolicy: this.documentTypePolicy,
    });
  }

  creditNote(data: Record<string, unknown>): WrappedInvoiceData {
    return creditNoteDataFrom(this.withConfiguredEmitter(data), {
      documentTypePolicy: this.documentTypePolicy,
    });
  }

  debitNote(data: Record<string, unknown>): WrappedInvoiceData {
    return debitNoteDataFrom(this.withConfiguredEmitter(data), {
      documentTypePolicy: this.documentTypePolicy,
    });
  }

  transportDocument(data: Record<string, unknown>): WrappedInvoiceData {
    return transportDocumentDataFrom(this.withConfiguredEmitter(data), {
      documentTypePolicy: this.documentTypePolicy,
    });
  }

  returnNote(data: Record<string, unknown>): WrappedInvoiceData {
    return returnNoteDataFrom(this.withConfiguredEmitter(data), {
      documentTypePolicy: this.documentTypePolicy,
    });
  }

  entryNote(data: Record<string, unknown>): WrappedInvoiceData {
    return entryNoteDataFrom(this.withConfiguredEmitter(data), {
      documentTypePolicy: this.documentTypePolicy,
    });
  }

  generateDocumentId(): string {
    return this.config.generators.documentId();
  }

  private withConfiguredEmitter(data: Record<string, unknown>): Record<string, unknown> {
    if (this.config.emitter === null || data.emitter !== undefined) {
      return data;
    }

    return { ...data, emitter: this.config.emitter };
  }
}
