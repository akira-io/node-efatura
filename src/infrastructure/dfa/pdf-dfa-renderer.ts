import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { dfaContingencyNotice } from '../../application/dfa/dfa';
import type { DfaDocument, DfaRenderer, DfaRenderInput } from '../../core/contracts';
import { EmissionMode } from '../../domain/enums/emission-mode';
import { renderDfaPdfLayout } from './pdf-dfa-layout';

export class PdfDfaRenderer implements DfaRenderer {
  async render(input: DfaRenderInput): Promise<DfaDocument> {
    const chunks: Buffer[] = [];
    const document = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true });
    const qrCode = await QRCode.toBuffer(input.qrCodeUrl, {
      errorCorrectionLevel: 'M',
      type: 'png',
      margin: 1,
      width: 132,
    });

    document.on('data', (chunk: Buffer) => chunks.push(chunk));

    const completed = new Promise<Buffer>((resolve, reject) => {
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);
    });

    renderDfaPdfLayout(document, input, qrCode, dfaPdfContingencyLines(input));

    document.end();

    return {
      contentType: 'application/pdf',
      filename: `${input.iud}.pdf`,
      buffer: await completed,
    };
  }
}

export function dfaPdfContingencyLines(
  input: Pick<DfaRenderInput, 'contingencyIuc' | 'emissionMode'>,
): string[] {
  const emissionMode = input.emissionMode ?? EmissionMode.Online;
  const notice = dfaContingencyNotice(emissionMode);

  if (!notice) {
    return [];
  }

  const iucLine =
    emissionMode === EmissionMode.Off && input.contingencyIuc
      ? [`IUC: ${input.contingencyIuc}`]
      : [];

  return [notice, ...iucLine, 'Pendente de Autorizacao'];
}
