import type { DfaRenderInput } from '../../core/contracts';
import { EmissionMode } from '../../domain/enums/emission-mode';
import { conversionEvidenceHeight, renderDfaConversionEvidence } from './pdf-dfa-conversion';
import { colors, drawLine, money, page } from './pdf-dfa-primitives';
import { renderDfaItemsTable } from './pdf-dfa-table';

type TotalRow = [string, string];
export function renderDfaPdfLayout(
  document: PDFKit.PDFDocument,
  input: DfaRenderInput,
  qrCode: Buffer,
  contingencyLines: string[],
): void {
  header(document, input);
  parties(document, input);
  documentFacts(document, input, contingencyLines);
  const nextY = renderDfaItemsTable(document, input, () => continuationPage(document, input));
  const totalsY = prepareTotalsArea(document, input, nextY);
  const totalsBottomY = totals(document, input, totalsY);
  const conversionBottomY = renderDfaConversionEvidence(document, input.conversion, totalsBottomY);

  verification(document, input, qrCode, Math.max(665, conversionBottomY + 18));
  pageNumbers(document);
}

function header(document: PDFKit.PDFDocument, input: DfaRenderInput): void {
  compactBrand(document, input.issuerName ?? 'e-Fatura');
  document.fillColor(colors.black).font('Helvetica-Bold').fontSize(13);
  document.text(input.title ?? 'DOCUMENTO FISCAL AUXILIAR', 320, 72, {
    width: 220,
    align: 'right',
    lineBreak: false,
  });
  document.fillColor(colors.muted).font('Helvetica').fontSize(9);
  document.text('DFA e-Fatura Cabo Verde', 320, 92, { width: 220, align: 'right' });
}

function compactBrand(document: PDFKit.PDFDocument, label: string): void {
  document.roundedRect(page.left, 68, 12, 17, 2).stroke(colors.accent);
  document.rect(page.left - 5, 75, 12, 17).stroke(colors.accent);
  document.fillColor(colors.black).font('Helvetica-Bold').fontSize(10);
  document.text(label, page.left + 20, 72, { width: 180, height: 14, ellipsis: true });
}

function parties(document: PDFKit.PDFDocument, input: DfaRenderInput): void {
  const y = 118;

  party(
    document,
    'Emissor',
    input.issuerName,
    input.issuerTaxId,
    input.issuerAddress,
    input.issuerContact,
    page.left,
    y,
  );
  party(
    document,
    'Cliente',
    input.customerName,
    input.customerTaxId,
    input.customerAddress,
    input.customerContact,
    page.left,
    y + 112,
  );
}

function party(
  document: PDFKit.PDFDocument,
  title: string,
  name: string | undefined,
  taxId: string | undefined,
  address: string | undefined,
  contact: string | undefined,
  x: number,
  y: number,
): void {
  document.fillColor(colors.black).font('Helvetica-Bold').fontSize(10);
  document.text(title, x, y, { width: 180 });
  document.fillColor(colors.black).font('Helvetica').fontSize(10);
  document.text(name ?? '-', x, y + 20, { width: 190, height: 14, ellipsis: true });
  document.text(`NIF: ${taxId ?? '-'}`, x, y + 38, { width: 190 });
  document.fillColor(colors.muted).fontSize(9);
  document.text(address ?? '-', x, y + 55, { width: 190, height: 14, ellipsis: true });
  document.text(contact ?? '-', x, y + 72, { width: 190, height: 14, ellipsis: true });
}

function documentFacts(
  document: PDFKit.PDFDocument,
  input: DfaRenderInput,
  contingencyLines: string[],
): void {
  const y = 118;
  fact(document, 'Tipo DFE:', String(input.documentTypeCode ?? '-'), 306, y);
  fact(document, 'Serie:', input.series ?? '-', 306, y + 22);
  fact(document, 'Numero:', input.documentNumber ?? '-', 306, y + 44);
  fact(document, 'Emissao:', formatDateTime(input.issueDate, input.issueTime), 306, y + 66);
  fact(document, 'Modo:', emissionModeText(input.emissionMode), 306, y + 88);

  if (contingencyLines.length > 0) {
    document.fillColor(colors.black).font('Helvetica-Bold').fontSize(9);
    document.text(contingencyLines.join(' - '), page.left, y + 66, { width: 210 });
  }
}

function continuationPage(document: PDFKit.PDFDocument, input: DfaRenderInput): void {
  document.addPage();
  header(document, input);
  documentFacts(document, input, []);
  document.fillColor(colors.black).font('Helvetica-Bold').fontSize(9);
  document.text('Continuacao', page.left, 118, { width: 180 });
  document.fillColor(colors.muted).font('Helvetica').fontSize(8);
  document.text(`IUD: ${input.iud}`, page.left, 136, {
    width: 210,
    height: 24,
    ellipsis: true,
  });
}

function fact(
  document: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
): void {
  document.fillColor(colors.black).font('Helvetica-Bold').fontSize(10);
  document.text(label, x, y, { width: 78 });
  document.fillColor(colors.black).font('Helvetica').fontSize(10);
  document.text(value, x + 86, y, { width: 150, align: 'right', height: 14, ellipsis: true });
}

function prepareTotalsArea(
  document: PDFKit.PDFDocument,
  input: DfaRenderInput,
  nextY: number,
): number {
  let totalsY = Math.max(nextY + 16, input.conversion ? 430 : 540);

  if (!summaryFits(document, input, totalsY)) {
    continuationPage(document, input);
    totalsY = 245;
  }

  return totalsY;
}

function summaryFits(
  document: PDFKit.PDFDocument,
  input: DfaRenderInput,
  totalsY: number,
): boolean {
  const totalsBottomY = totalsY + totalRows(input).length * 21;
  const conversionBottomY = totalsBottomY + conversionEvidenceHeight(document, input.conversion);
  const verificationY = Math.max(665, conversionBottomY + 18);

  return verificationY + 96 <= 790;
}

function totalRows(input: DfaRenderInput): TotalRow[] {
  const totalsInput = input.totals;

  return totalsInput
    ? [
        ['Subtotal:', money(totalsInput.netTotalAmount, 'CVE')],
        ['Descontos:', money(totalsInput.discountTotalAmount, 'CVE')],
        ['Encargos:', money(totalsInput.chargeTotalAmount, 'CVE')],
        ['Imposto:', money(totalsInput.taxTotalAmount, 'CVE')],
        ['Total:', money(totalsInput.payableAmount, 'CVE')],
      ]
    : [['Total:', money(input.total ?? 0, 'CVE')]];
}

function totals(document: PDFKit.PDFDocument, input: DfaRenderInput, startY: number): number {
  const values = totalRows(input);

  values.forEach(([label, value], index) => {
    const y = startY + index * 21;
    const finalLine = index === values.length - 1;

    if (finalLine) {
      drawLine(document, 318, y - 5, 540, y - 5, colors.border);
    }

    document
      .fillColor(colors.black)
      .font(finalLine ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(finalLine ? 17 : 10);
    document.text(label, 318, y, { width: 96 });
    document.text(value, 410, y, { width: 130, align: 'right' });
  });

  return startY + values.length * 21;
}

function verification(
  document: PDFKit.PDFDocument,
  input: DfaRenderInput,
  qrCode: Buffer,
  y: number,
): void {
  drawLine(document, page.left, y, page.right, y, colors.border);
  document.image(qrCode, page.left + 10, y + 18, { width: 72 });
  document.fillColor(colors.black).font('Helvetica-Bold').fontSize(10);
  document.text('Consulta DFE', 156, y + 22);
  document.fillColor(colors.black).font('Helvetica').fontSize(9);
  document.text('Este documento identifica o DFE na plataforma e-Fatura.', 156, y + 42, {
    width: 340,
  });
  document.fillColor(colors.muted).fontSize(8);
  document.text(`IUD: ${input.iud}`, 156, y + 62, { width: 340, height: 12, ellipsis: true });
  document.text('Plataforma Eletronica da Fatura Eletronica de Cabo Verde.', 156, y + 82, {
    width: 340,
  });
}

function pageNumbers(document: PDFKit.PDFDocument): void {
  const range = document.bufferedPageRange();

  for (let index = 0; index < range.count; index += 1) {
    document.switchToPage(range.start + index);
    document.fillColor(colors.muted).font('Helvetica').fontSize(8);
    document.text(`Pag. ${index + 1}/${range.count}`, page.left, 34, {
      width: page.width,
      align: 'right',
    });
  }
}

function emissionModeText(mode: DfaRenderInput['emissionMode']): string {
  if (mode === EmissionMode.Offline) {
    return 'Offline';
  }

  if (mode === EmissionMode.Off) {
    return 'Off';
  }

  return 'Online';
}

function formatDateTime(date: string | undefined, time: string | null | undefined): string {
  if (!date) {
    return '-';
  }

  return time ? `${date} ${time}` : date;
}
