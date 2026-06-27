import type { DfaLineInput, DfaRenderInput, DfaTotalsInput } from '../../core/contracts';
import { documentTypeCode } from '../../domain/enums/document-type';
import { normalizeEmissionMode } from '../../domain/enums/emission-mode';
import type { InvoiceData } from '../../domain/value-objects/invoice-data';
import type { LineItemData } from '../../domain/value-objects/line-item-data';
import type { TotalsData } from '../../domain/value-objects/totals-data';
import type { RenderDfaOptions } from '../efatura-options';

export function dfaRenderInputFrom(options: RenderDfaOptions, qrCodeUrl: string): DfaRenderInput {
  return {
    iud: options.iud,
    qrCodeUrl,
    title: options.title,
    documentTypeCode: options.invoice ? documentTypeCode(options.invoice.type) : undefined,
    issueDate: options.invoice?.issueDate,
    issueTime: options.invoice?.issueTime,
    issuerTaxId: options.invoice?.emitter.taxId?.value,
    issuerName: options.invoice?.emitter.name ?? undefined,
    customerTaxId: options.invoice?.receiver?.taxId?.value,
    customerName: options.invoice?.receiver?.name ?? undefined,
    lines: options.invoice?.lines.map(dfaLineFrom),
    totals: dfaTotalsFromInvoice(options.invoice),
    total: options.invoice?.totals?.payableAmount,
    currency: options.currency,
    emissionMode: normalizeEmissionMode(options.emissionMode),
  };
}

function dfaLineFrom(line: LineItemData): DfaLineInput {
  return {
    description: line.item.description,
    quantity: line.quantity.value,
    unitCode: line.quantity.unitCode,
    netTotal: line.netTotal ?? 0,
    taxTotal: line.taxes.reduce((total, tax) => total + (tax.taxTotal ?? 0), 0),
  };
}

function dfaTotalsFromInvoice(invoice: InvoiceData | undefined): DfaTotalsInput | undefined {
  return invoice?.totals ? dfaTotalsFrom(invoice.totals) : undefined;
}

function dfaTotalsFrom(totals: TotalsData): DfaTotalsInput {
  return {
    priceExtensionTotalAmount: totals.priceExtensionTotalAmount,
    chargeTotalAmount: totals.chargeTotalAmount ?? 0,
    discountTotalAmount: totals.discountTotalAmount ?? 0,
    netTotalAmount: totals.netTotalAmount,
    taxTotalAmount: totals.taxTotalAmount,
    payableAmount: totals.payableAmount,
  };
}
