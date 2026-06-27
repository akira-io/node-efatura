import type { EmissionMode } from '../../domain/enums/emission-mode';

export interface DfaRenderInput {
  iud: string;
  qrCodeUrl: string;
  title?: string;
  documentTypeCode?: number;
  issueDate?: string;
  issueTime?: string | null;
  issuerTaxId?: string;
  issuerName?: string;
  customerTaxId?: string;
  customerName?: string;
  lines?: DfaLineInput[];
  totals?: DfaTotalsInput;
  total?: number;
  currency?: string;
  emissionMode?: EmissionMode;
}

export interface DfaLineInput {
  description: string;
  quantity: number;
  unitCode: string | null;
  netTotal: number;
  taxTotal: number;
}

export interface DfaTotalsInput {
  priceExtensionTotalAmount: number;
  chargeTotalAmount: number;
  discountTotalAmount: number;
  netTotalAmount: number;
  taxTotalAmount: number;
  payableAmount: number;
}

export interface DfaDocument {
  contentType: 'application/pdf';
  filename: string;
  buffer: Buffer;
}

export interface DfaRenderer {
  render(input: DfaRenderInput): Promise<DfaDocument>;
}
