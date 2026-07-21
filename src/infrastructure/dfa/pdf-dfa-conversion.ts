import type { CurrencyConversionMetadata } from '../../core/contracts';
import { colors, drawLine, formatAmount, money, page } from './pdf-dfa-primitives';

const rowHeight = 15;
const valueX = 154;
const valueWidth = page.right - valueX;

export function conversionEvidenceHeight(
  document: PDFKit.PDFDocument,
  conversion: CurrencyConversionMetadata | undefined,
): number {
  if (!conversion) {
    return 0;
  }

  const sourceHeight = conversion.sourceUrl ? sourceUrlHeight(document, conversion.sourceUrl) : 0;

  return 14 + 18 + rowHeight * 4 + (conversion.sourceUrl ? 13 + sourceHeight : 0);
}

export function renderDfaConversionEvidence(
  document: PDFKit.PDFDocument,
  conversion: CurrencyConversionMetadata | undefined,
  startY: number,
): number {
  if (!conversion) {
    return startY;
  }

  const top = startY + 14;
  drawLine(document, page.left, top - 6, page.right, top - 6, colors.border);
  document.fillColor(colors.black).font('Helvetica-Bold').fontSize(10);
  document.text('Conversão cambial', page.left, top, { width: page.width });

  const rows: Array<[string, string]> = [
    ['Valor original:', money(conversion.originalPayableAmount, conversion.sourceCurrency)],
    ['Taxa aplicada:', `1 ${conversion.sourceCurrency} = ${formatAmount(conversion.rate, 3)} CVE`],
    ['Data da taxa:', formatDate(conversion.effectiveAt)],
    ['Fonte:', conversion.provider],
  ];
  const rowsY = top + 18;

  rows.forEach(([label, value], index) => {
    drawKeyValueRow(document, label, value, rowsY + index * rowHeight);
  });

  const rowsBottom = rowsY + rows.length * rowHeight;

  if (!conversion.sourceUrl) {
    return rowsBottom;
  }

  return drawWrappedSource(document, conversion.sourceUrl, rowsBottom + 5);
}

function drawKeyValueRow(
  document: PDFKit.PDFDocument,
  label: string,
  value: string,
  y: number,
): void {
  document.fillColor(colors.muted).font('Helvetica-Bold').fontSize(8);
  document.text(label, page.left, y, { width: 94 });
  document.fillColor(colors.black).font('Helvetica').fontSize(8);
  document.text(value, valueX, y, { width: valueWidth });
}

function drawWrappedSource(document: PDFKit.PDFDocument, sourceUrl: string, y: number): number {
  document.fillColor(colors.muted).font('Helvetica-Bold').fontSize(8);
  document.text('Fonte online:', page.left, y, { width: 94 });
  document.fillColor(colors.black).font('Helvetica').fontSize(8);
  document.text(sourceUrl, valueX, y, { width: valueWidth });

  return y + sourceUrlHeight(document, sourceUrl);
}

function sourceUrlHeight(document: PDFKit.PDFDocument, sourceUrl: string): number {
  document.font('Helvetica').fontSize(8);

  return document.heightOfString(sourceUrl, { width: valueWidth });
}

function formatDate(value: Date): string {
  const day = String(value.getUTCDate()).padStart(2, '0');
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const year = value.getUTCFullYear();

  return `${day}/${month}/${year}`;
}
