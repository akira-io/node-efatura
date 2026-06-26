import type { DocumentType } from '../../domain/enums/document-type';
import type { InvoiceData } from '../../domain/value-objects/invoice-data';

export type PartyInput = {
  nif: string;
  name: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type TaxInput = {
  type: string;
  rate: number;
  amount: number;
  exemptionReason?: string | null;
};

export type LineItemInput = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  taxes?: TaxInput[];
};

export type TotalsInput = {
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
};

type InvoiceRecord = Record<string, unknown> & {
  lines?: LineItemInput[];
};

export class InvoiceBuilder {
  private readonly data: InvoiceRecord = {};

  constructor(
    private readonly validator: (data: Record<string, unknown>) => InvoiceData,
    private readonly generateId: () => string,
  ) {}

  id(id: string): this {
    this.data.id = id;

    return this;
  }

  type(type: DocumentType): this {
    this.data.type = type;

    return this;
  }

  issueDate(issueDate: string): this {
    this.data.issueDate = issueDate;

    return this;
  }

  emitter(emitter: PartyInput): this {
    this.data.emitter = emitter;

    return this;
  }

  receiver(receiver: PartyInput | null): this {
    this.data.receiver = receiver;

    return this;
  }

  line(line: LineItemInput): this {
    this.data.lines = [...(this.data.lines ?? []), line];

    return this;
  }

  lines(lines: LineItemInput[]): this {
    this.data.lines = lines;

    return this;
  }

  totals(totals: TotalsInput): this {
    this.data.totals = totals;

    return this;
  }

  originalIud(originalIud: string): this {
    this.data.originalIud = originalIud;

    return this;
  }

  creditNoteReason(creditNoteReason: string): this {
    this.data.creditNoteReason = creditNoteReason;

    return this;
  }

  toRecord(): Record<string, unknown> {
    return {
      id: this.data.id ?? this.generateId(),
      ...this.data,
    };
  }

  validate(): InvoiceData {
    return this.validator(this.toRecord());
  }
}
