import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { dfaContingencyNotice } from '../../application/dfa/dfa';
import type { DfaDocument, DfaLineInput, DfaRenderer, DfaRenderInput } from '../../core/contracts';
import { EmissionMode } from '../../domain/enums/emission-mode';

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
    document.fontSize(9).text('E-Fatura Cabo Verde', { align: 'center' });
    document.moveDown(1.2);
    document.fontSize(10).text(`IUD: ${input.iud}`, 48, document.y, { width: 360 });
    document.text(`Tipo DFE: ${input.documentTypeCode ?? '-'}`, { width: 360 });
    document.text(`Emissao: ${formatDateTime(input.issueDate, input.issueTime)}`, { width: 360 });
    document.text(`Consulta DFE: ${input.qrCodeUrl}`, { width: 360 });

    const contingencyLines = dfaPdfContingencyLines(input);

    if (contingencyLines.length > 0) {
      document.moveDown();
      contingencyLines.forEach((line, index) => {
        document.fontSize(index === 0 ? 12 : 10).text(line, { align: 'center' });
      });
    }

    document.moveDown();
    document.image(qrCode, document.page.width - document.page.margins.right - 140, 120, {
      width: 140,
    });

    const partyStartY = Math.max(document.y + 12, 250);
    partyBlock(document, 'Emissor', input.issuerName, input.issuerTaxId, 48, partyStartY);
    partyBlock(document, 'Cliente', input.customerName, input.customerTaxId, 310, partyStartY);

    document.y = partyStartY + 86;
    linesTable(document, input.lines ?? [], input.currency ?? 'CVE');
    totalsBlock(document, input);

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

function partyBlock(
  document: PDFKit.PDFDocument,
  title: string,
  name: string | undefined,
  taxId: string | undefined,
  x: number,
  y: number,
): void {
  document.rect(x, y, 237, 68).stroke('#999999');
  document.fontSize(9).text(title, x + 8, y + 8, { width: 221 });
  document.fontSize(11).text(name ?? '-', x + 8, y + 24, { width: 221 });
  document.fontSize(9).text(`NIF: ${taxId ?? '-'}`, x + 8, y + 45, { width: 221 });
}

function linesTable(document: PDFKit.PDFDocument, lines: DfaLineInput[], currency: string): void {
  const startX = 48;
  const widths = [230, 70, 95, 95];
  let y = document.y;

  document.fontSize(10).text('Itens', startX, y);
  y += 18;
  row(document, y, ['Descricao', 'Qtd.', `Base (${currency})`, `Imp. (${currency})`], widths, true);
  y += 22;

  for (const line of lines.slice(0, 12)) {
    row(
      document,
      y,
      [
        line.description,
        `${formatAmount(line.quantity)}${line.unitCode ? ` ${line.unitCode}` : ''}`,
        formatAmount(line.netTotal),
        formatAmount(line.taxTotal),
      ],
      widths,
      false,
    );
    y += 22;
  }

  if (lines.length > 12) {
    document.fontSize(8).text(`+${lines.length - 12} linhas adicionais`, startX, y + 2);
    y += 18;
  }

  document.y = y + 10;
}

function row(
  document: PDFKit.PDFDocument,
  y: number,
  values: string[],
  widths: number[],
  header: boolean,
): void {
  let x = 48;

  if (header) {
    document
      .rect(
        x,
        y - 4,
        widths.reduce((total, width) => total + width, 0),
        20,
      )
      .fill('#f3f4f6');
    document.fillColor('#000000');
  }

  values.forEach((value, index) => {
    const width = widths[index] ?? 0;

    document.fontSize(header ? 8 : 9).text(value, x + 4, y, {
      width: width - 8,
      height: 16,
      ellipsis: true,
    });
    x += width;
  });
}

function totalsBlock(document: PDFKit.PDFDocument, input: DfaRenderInput): void {
  const totals = input.totals;
  const currency = input.currency ?? 'CVE';

  if (!totals && typeof input.total !== 'number') {
    return;
  }

  const x = 340;
  const y = document.y;
  const lines = totals
    ? [
        ['Base', totals.netTotalAmount],
        ['Descontos', totals.discountTotalAmount],
        ['Encargos', totals.chargeTotalAmount],
        ['Imposto', totals.taxTotalAmount],
        ['Total', totals.payableAmount],
      ]
    : [['Total', input.total ?? 0]];

  document.rect(x, y, 205, 22 + lines.length * 17).stroke('#999999');
  document.fontSize(10).text('Totais', x + 8, y + 8);

  lines.forEach(([label, value], index) => {
    document
      .fontSize(index === lines.length - 1 ? 11 : 9)
      .text(String(label), x + 8, y + 28 + index * 17, {
        width: 82,
      });
    document.text(`${formatAmount(Number(value))} ${currency}`, x + 96, y + 28 + index * 17, {
      width: 95,
      align: 'right',
    });
  });

  document.y = y + 34 + lines.length * 17;
  document.moveDown();
}

function formatDateTime(date: string | undefined, time: string | null | undefined): string {
  if (!date) {
    return '-';
  }

  return time ? `${date} ${time}` : date;
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat('pt-CV', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 5,
  }).format(value);
}
