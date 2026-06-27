import type { DocumentType } from '../../domain/enums/document-type';
import type { InvoiceData } from '../../domain/value-objects/invoice-data';

export type PartyInput = {
  taxId: {
    countryCode: string;
    value: string;
  };
  name: string;
  address?: Record<string, unknown> | null;
  contacts?: Record<string, unknown> | null;
};

export type TaxInput = {
  taxTypeCode: string;
  stampTaxCode?: string | null;
  taxPercentage?: number | null;
  taxAmount?: number | null;
  taxExemptionReasonCode?: string | null;
  taxTotal?: number | null;
};

export type LineItemInput = {
  quantity: Record<string, unknown>;
  price?: number | null;
  priceExtension?: number | null;
  netTotal?: number | null;
  taxes?: TaxInput[];
  item: Record<string, unknown>;
};

export type TotalsInput = {
  priceExtensionTotalAmount: number;
  chargeTotalAmount?: number | null;
  discountTotalAmount?: number | null;
  netTotalAmount: number;
  taxTotalAmount: number;
  withholdingTaxTotalAmount?: number | null;
  payableRoundingAmount?: number | null;
  payableAmount: number;
  payableAlternativeAmounts?: Record<string, unknown>[];
};

type InvoiceRecord = Record<string, unknown> & {
  lines?: LineItemInput[];
};

export class InvoiceBuilder {
  private readonly data: InvoiceRecord = {};

  constructor(
    private readonly validator: (data: Record<string, unknown>) => InvoiceData,
    private readonly generateId: () => string,
    private readonly defaultData: Record<string, unknown> = {},
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

  issueReasonCode(issueReasonCode: string): this {
    this.data.issueReasonCode = issueReasonCode;

    return this;
  }

  references(references: Record<string, unknown>[]): this {
    this.data.references = references;

    return this;
  }

  toRecord(): Record<string, unknown> {
    return {
      ...this.defaultData,
      id: this.data.id ?? this.generateId(),
      ...this.data,
    };
  }

  validate(): InvoiceData {
    return this.validator(this.toRecord());
  }
}
