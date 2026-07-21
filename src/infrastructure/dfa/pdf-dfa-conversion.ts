import type { CurrencyConversionMetadata } from '../../core/contracts';
import { colors, drawLine, money, page } from './pdf-dfa-primitives';

const evidenceBottomY = 676;
const labelWidth = 94;
const rowGap = 5;
const valueX = 154;
const valueWidth = page.right - valueX;

type ContinueEvidencePage = () => number;
type EvidenceRow = [label: string, value: string];

export function renderDfaConversionEvidence(
  document: PDFKit.PDFDocument,
  conversion: CurrencyConversionMetadata | undefined,
  startY: number,
  continuePage: ContinueEvidencePage,
): number {
  if (!conversion) {
    return startY;
  }

  const rows: EvidenceRow[] = [
    ['Valor original:', money(conversion.originalPayableAmount, conversion.sourceCurrency)],
    ['Taxa aplicada:', `1 ${conversion.sourceCurrency} = ${formatRate(conversion.rate)} CVE`],
    ['Data da taxa:', formatDate(conversion.effectiveAt)],
    ['Fonte:', conversion.provider],
  ];

  if (conversion.sourceUrl) {
    rows.push(['Fonte online:', conversion.sourceUrl]);
  }

  let cursorY = drawEvidenceHeading(document, startY, continuePage);

  rows.forEach(([label, value], index) => {
    cursorY = drawPaginatedRow(document, label, value, cursorY, continuePage);

    if (index < rows.length - 1) {
      cursorY += rowGap;
    }
  });

  return cursorY;
}

function drawEvidenceHeading(
  document: PDFKit.PDFDocument,
  startY: number,
  continuePage: ContinueEvidencePage,
): number {
  document.font('Helvetica-Bold').fontSize(10);
  const headingHeight = document.heightOfString('Conversão cambial', { width: page.width });
  let top = startY + 14;

  if (top + headingHeight > evidenceBottomY) {
    top = continueEvidenceAt(continuePage, headingHeight);
  }

  drawLine(document, page.left, top - 6, page.right, top - 6, colors.border);
  document.fillColor(colors.black).font('Helvetica-Bold').fontSize(10);
  document.text('Conversão cambial', page.left, top, { width: page.width });

  return top + headingHeight + 8;
}

function drawPaginatedRow(
  document: PDFKit.PDFDocument,
  label: string,
  value: string,
  startY: number,
  continuePage: ContinueEvidencePage,
): number {
  const characters = Array.from(value);
  let cursorY = startY;
  let offset = 0;

  while (offset < characters.length) {
    const labelHeight = textHeight(document, label, 'Helvetica-Bold', labelWidth);
    const availableHeight = evidenceBottomY - cursorY;
    const chunkLength = fittingCharacterCount(document, characters, offset, availableHeight);

    if (availableHeight < labelHeight || chunkLength === 0) {
      cursorY = continueEvidenceAt(continuePage, labelHeight);
      continue;
    }

    const chunk = characters.slice(offset, offset + chunkLength).join('');
    const valueHeight = textHeight(document, chunk, 'Helvetica', valueWidth);
    drawKeyValueRow(document, label, chunk, cursorY);
    cursorY += Math.max(labelHeight, valueHeight);
    offset += chunkLength;

    if (offset < characters.length) {
      cursorY = continueEvidenceAt(continuePage, labelHeight);
    }
  }

  return cursorY;
}

function fittingCharacterCount(
  document: PDFKit.PDFDocument,
  characters: string[],
  offset: number,
  availableHeight: number,
): number {
  let lower = 1;
  let upper = characters.length - offset;
  let fittingCount = 0;

  while (lower <= upper) {
    const middle = Math.floor((lower + upper) / 2);
    const candidate = characters.slice(offset, offset + middle).join('');
    const candidateHeight = textHeight(document, candidate, 'Helvetica', valueWidth);

    if (candidateHeight <= availableHeight) {
      fittingCount = middle;
      lower = middle + 1;
      continue;
    }

    upper = middle - 1;
  }

  return fittingCount;
}

function continueEvidenceAt(continuePage: ContinueEvidencePage, requiredHeight: number): number {
  const nextY = continuePage();

  if (nextY + requiredHeight > evidenceBottomY) {
    throw new Error('DFA continuation page has no room for conversion evidence.');
  }

  return nextY;
}

function drawKeyValueRow(
  document: PDFKit.PDFDocument,
  label: string,
  value: string,
  y: number,
): void {
  document.fillColor(colors.muted).font('Helvetica-Bold').fontSize(8);
  document.text(label, page.left, y, { width: labelWidth });
  document.fillColor(colors.black).font('Helvetica').fontSize(8);
  document.text(value, valueX, y, { width: valueWidth });
}

function textHeight(
  document: PDFKit.PDFDocument,
  value: string,
  font: 'Helvetica' | 'Helvetica-Bold',
  width: number,
): number {
  document.font(font).fontSize(8);

  return document.heightOfString(value, { width });
}

function formatRate(rate: number): string {
  return new Intl.NumberFormat('pt-CV', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 5,
  }).format(rate);
}

function formatDate(value: Date): string {
  const day = String(value.getUTCDate()).padStart(2, '0');
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const year = value.getUTCFullYear();

  return `${day}/${month}/${year}`;
}
