import type { EmissionMode } from '../../domain/enums/emission-mode';
import type { CurrencyConversionMetadata } from './exchange-rate-provider';

export interface DfaRenderInput {
  iud: string;
  qrCodeUrl: string;
  title?: string;
  documentTypeCode?: number;
  series?: string;
  documentNumber?: string;
  issueDate?: string;
  issueTime?: string | null;
  issuerTaxId?: string;
  issuerName?: string;
  issuerAddress?: string;
  issuerContact?: string;
  customerTaxId?: string;
  customerName?: string;
  customerAddress?: string;
  customerContact?: string;
  lines?: DfaLineInput[];
  totals?: DfaTotalsInput;
  total?: number;
  currency?: 'CVE';
  conversion?: CurrencyConversionMetadata;
  emissionMode?: EmissionMode;
  contingencyIuc?: string;
}

export interface DfaLineInput {
  code: string;
  description: string;
  quantity: number;
  unitCode: string | null;
  unitPrice: number;
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
