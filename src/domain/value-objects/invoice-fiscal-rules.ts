import { DocumentType } from '../enums/document-type';
import { TaxTypeCode } from '../enums/tax-type-code';
import { EfaturaValidationError } from '../errors';
import type { InvoiceData } from './invoice-data';
import type { LineItemData } from './line-item-data';

const MONEY_TOLERANCE = 0.01;

export function assertInvoiceFiscalRules(invoice: InvoiceData): void {
  assertEmitterContacts(invoice);
  assertLineIds(invoice.lines);
  assertLineTaxes(invoice);
  assertRempeInvoiceTaxCodes(invoice);
  assertTotals(invoice);
}

function assertEmitterContacts(invoice: InvoiceData): void {
  const contacts = invoice.emitter.contacts;

  if (!contacts?.email) {
    throw new EfaturaValidationError(
      'emitter.contacts.email',
      'Emitter email is required.',
      'emitter.email_required',
    );
  }

  if (!contacts.telephone && !contacts.mobilephone) {
    throw new EfaturaValidationError(
      'emitter.contacts.telephone',
      'Emitter telephone or mobilephone is required.',
      'emitter.phone_required',
    );
  }
}

function assertLineIds(lines: LineItemData[]): void {
  const lineIds = new Set<string>();

  lines.forEach((line, index) => {
    if (line.id !== null && lineIds.has(line.id)) {
      throw new EfaturaValidationError(
        `lines.${index}.id`,
        'Line id must be unique in the document.',
        'line.id_unique',
      );
    }

    if (line.id !== null) {
      lineIds.add(line.id);
    }
  });

  lines.forEach((line, index) => {
    if (line.lineTypeCode !== 'C' || line.lineReferenceId === null) {
      return;
    }

    if (!lineIds.has(line.lineReferenceId)) {
      throw new EfaturaValidationError(
        `lines.${index}.lineReferenceId`,
        'LineReferenceId must reference an existing line id.',
        'line.reference_missing',
      );
    }
  });
}

function assertLineTaxes(invoice: InvoiceData): void {
  if (!requiresLineTaxes(invoice.type)) {
    return;
  }

  invoice.lines.forEach((line, index) => {
    if (line.taxes.length === 0) {
      throw new EfaturaValidationError(
        `lines.${index}.taxes`,
        'Line tax is required for this document type.',
        'line.tax_required',
      );
    }
  });
}

function assertTotals(invoice: InvoiceData): void {
  if (invoice.totals === null || invoice.lines.length === 0) {
    return;
  }

  assertMoneyEquals(
    'totals.priceExtensionTotalAmount',
    invoice.totals.priceExtensionTotalAmount,
    sumSigned(invoice.lines, (line) => line.priceExtension),
  );
  assertMoneyEquals(
    'totals.netTotalAmount',
    invoice.totals.netTotalAmount,
    sumSigned(invoice.lines, (line) => line.netTotal),
  );

  const taxTotals = taxTotalsFrom(invoice.lines);

  assertMoneyEquals('totals.taxTotalAmount', invoice.totals.taxTotalAmount, taxTotals.taxTotal);

  if (invoice.totals.withholdingTaxTotalAmount !== null) {
    assertMoneyEquals(
      'totals.withholdingTaxTotalAmount',
      invoice.totals.withholdingTaxTotalAmount,
      taxTotals.withholdingTotal,
    );
  }

  const payableRoundingAmount = invoice.totals.payableRoundingAmount ?? 0;
  const expectedPayableAmount =
    invoice.totals.netTotalAmount + invoice.totals.taxTotalAmount + payableRoundingAmount;

  assertMoneyEquals('totals.payableAmount', invoice.totals.payableAmount, expectedPayableAmount);
}

function requiresLineTaxes(type: DocumentType): boolean {
  const optionalTaxTypes: readonly DocumentType[] = [
    DocumentType.ElectronicCreditNote,
    DocumentType.ElectronicTransportDocument,
    DocumentType.ElectronicReturnNote,
  ];

  return !optionalTaxTypes.includes(type);
}

function assertRempeInvoiceTaxCodes(invoice: InvoiceData): void {
  if (
    invoice.type !== DocumentType.ElectronicInvoice ||
    invoice.emitter.fiscalFramework !== 'REMPE'
  ) {
    return;
  }

  invoice.lines.forEach((line, lineIndex) => {
    line.taxes.forEach((tax, taxIndex) => {
      if (tax.taxTypeCode === TaxTypeCode.NotApplicable) {
        return;
      }

      throw new EfaturaValidationError(
        `lines.${lineIndex}.taxes.${taxIndex}.taxTypeCode`,
        'REMPE emitter invoices must use NA tax code.',
        'tax.rempe_invoice_requires_na',
      );
    });
  });
}

function lineSign(line: LineItemData): number {
  return line.lineTypeCode === 'D' ? -1 : 1;
}

function isIgnoredLine(line: LineItemData): boolean {
  return line.lineTypeCode === 'I';
}

function sumSigned(
  lines: LineItemData[],
  selector: (line: LineItemData) => number | null,
): number | null {
  let total = 0;

  for (const line of lines) {
    if (isIgnoredLine(line)) {
      continue;
    }

    const value = selector(line);

    if (value === null) {
      return null;
    }

    total += lineSign(line) * value;
  }

  return roundMoney(total);
}

function taxTotalsFrom(lines: LineItemData[]): {
  taxTotal: number | null;
  withholdingTotal: number;
} {
  let missingTaxTotal = false;
  let taxTotal = 0;
  let withholdingTotal = 0;

  for (const line of lines) {
    if (isIgnoredLine(line)) {
      continue;
    }

    const sign = lineSign(line);

    for (const tax of line.taxes) {
      if (tax.taxTotal === null) {
        missingTaxTotal = true;
        continue;
      }

      if (tax.taxTypeCode === TaxTypeCode.IncomeTax) {
        withholdingTotal += sign * tax.taxTotal;
        continue;
      }

      taxTotal += sign * tax.taxTotal;
    }
  }

  return {
    taxTotal: missingTaxTotal ? null : roundMoney(taxTotal),
    withholdingTotal: roundMoney(withholdingTotal),
  };
}

function assertMoneyEquals(field: string, actual: number, expected: number | null): void {
  if (expected === null || Math.abs(roundMoney(actual) - expected) <= MONEY_TOLERANCE) {
    return;
  }

  throw new EfaturaValidationError(
    field,
    'Document totals must match line amounts.',
    'invoice.totals_mismatch',
  );
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
