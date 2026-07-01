export const page = { left: 54, right: 541, width: 487 };

export const colors = {
  black: '#1f2328',
  border: '#d8d8d8',
  muted: '#555f6f',
  accent: '#3b22d4',
};

export function drawLine(
  document: PDFKit.PDFDocument,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: string,
): void {
  document.moveTo(fromX, fromY).lineTo(toX, toY).stroke(color);
}

export function money(value: number, currency: string): string {
  return `${formatAmount(value, 2)} ${currency}`;
}

export function formatAmount(value: number, digits: number): string {
  return new Intl.NumberFormat('pt-CV', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}
