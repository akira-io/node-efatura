import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { dfaContingencyNotice } from '../../application/dfa/dfa';
import type { DfaDocument, DfaRenderer, DfaRenderInput } from '../../core/contracts';

export class PdfDfaRenderer implements DfaRenderer {
  async render(input: DfaRenderInput): Promise<DfaDocument> {
    const chunks: Buffer[] = [];
    const document = new PDFDocument({ size: 'A4', margin: 48 });
    const qrCode = await QRCode.toBuffer(input.qrCodeUrl, {
      errorCorrectionLevel: 'M',
      type: 'png',
      margin: 1,
      width: 140,
    });

    document.on('data', (chunk: Buffer) => chunks.push(chunk));

    const completed = new Promise<Buffer>((resolve, reject) => {
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);
    });

    document.fontSize(18).text(input.title ?? 'Documento Fiscal Auxiliar', { align: 'center' });
    document.moveDown();
    document.fontSize(10).text(`IUD: ${input.iud}`);
    document.text(`Consulta DFE: ${input.qrCodeUrl}`);

    const notice = dfaContingencyNotice(input.emissionMode !== 'Online');

    if (notice) {
      document.moveDown();
      document.fontSize(12).text(notice, { align: 'center' });
      document.fontSize(10).text('Pendente de Autorizacao', { align: 'center' });
    }

    document.moveDown();
    document.image(qrCode, document.page.width - document.page.margins.right - 140, 120, {
      width: 140,
    });

    document.fontSize(11);
    document.text(`Emissor: ${input.issuerName ?? '-'}`);
    document.text(`Cliente: ${input.customerName ?? '-'}`);

    if (typeof input.total === 'number') {
      document.text(`Total: ${formatAmount(input.total)} ${input.currency ?? 'CVE'}`);
    }

    document.moveDown();
    document
      .fontSize(9)
      .text(
        'Este documento identifica o DFE na Plataforma Eletronica da Fatura Eletronica de Cabo Verde.',
      );

    document.end();

    return {
      contentType: 'application/pdf',
      filename: `${input.iud}.pdf`,
      buffer: await completed,
    };
  }
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat('pt-CV', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 5,
  }).format(value);
}
