import type { DfaLineInput, DfaRenderInput } from '../../core/contracts';
import { colors, drawLine, formatAmount, money, page } from './pdf-dfa-primitives';

const firstTableY = 350;
const continuedTableY = 245;
const rowHeight = 27;
const pageBottomY = 700;
const columnWidths = [86, 170, 36, 65, 58, 72];
const labels = ['Codigo', 'Descricao', 'Qtd.', 'Preco', 'IVA', 'Total'];

export function renderDfaItemsTable(
  document: PDFKit.PDFDocument,
  input: DfaRenderInput,
  onContinuationPage: () => void,
): number {
  const lines = input.lines ?? [];
  const currency = input.currency ?? 'CVE';
  let runningTotal = 0;
  let rowY = drawHeader(document, firstTableY);

  lines.forEach((line) => {
    if (rowY + 18 > pageBottomY) {
      carryForward(document, runningTotal, currency);
      onContinuationPage();
      rowY = drawHeader(document, continuedTableY);
    }

    drawRow(document, rowY, valuesFor(line), false);
    drawLine(document, page.left, rowY + 18, page.right, rowY + 18, '#eeeeee');
    runningTotal += grossLineTotal(line);
    rowY += rowHeight;
  });

  return rowY + 8;
}

function drawHeader(document: PDFKit.PDFDocument, y: number): number {
  drawLine(document, page.left, y + 17, page.right, y + 17, colors.border);
  drawRow(document, y + 26, labels, true);
  drawLine(document, page.left, y + 44, page.right, y + 44, colors.border);

  return y + 56;
}

function drawRow(document: PDFKit.PDFDocument, y: number, values: string[], header: boolean): void {
  let x = page.left + 12;

  document
    .fillColor(colors.black)
    .font(header ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(header ? 11 : 9);

  values.forEach((value, index) => {
    const align = index > 1 ? 'right' : 'left';
    const width = columnWidths[index] ?? 0;

    document.text(value, x, y, {
      width: width - 8,
      height: 14,
      align,
      ellipsis: true,
    });
    x += width;
  });
}

function valuesFor(line: DfaLineInput): string[] {
  return [
    line.code,
    line.description,
    `${formatAmount(line.quantity, 0)} ${line.unitCode ?? ''}`.trim(),
    formatAmount(line.unitPrice, 2),
    formatAmount(line.taxTotal, 2),
    formatAmount(grossLineTotal(line), 2),
  ];
}

function grossLineTotal(line: DfaLineInput): number {
  return line.netTotal + line.taxTotal;
}

function carryForward(document: PDFKit.PDFDocument, amount: number, currency: string): void {
  drawLine(document, 318, pageBottomY + 6, page.right, pageBottomY + 6, colors.border);
  document.fillColor(colors.black).font('Helvetica-Bold').fontSize(10);
  document.text('A transportar', 318, pageBottomY + 15, { width: 96 });
  document.text(money(amount, currency), 410, pageBottomY + 15, {
    width: 130,
    align: 'right',
  });
}
