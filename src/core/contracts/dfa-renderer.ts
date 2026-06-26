import type { EmissionMode } from '../../application/xml/dfe-xml';

export interface DfaRenderInput {
  iud: string;
  qrCodeUrl: string;
  title?: string;
  issuerName?: string;
  customerName?: string;
  total?: number;
  currency?: string;
  emissionMode?: EmissionMode;
}

export interface DfaDocument {
  contentType: 'application/pdf';
  filename: string;
  buffer: Buffer;
}

export interface DfaRenderer {
  render(input: DfaRenderInput): Promise<DfaDocument>;
}
