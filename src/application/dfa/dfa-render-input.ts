import type { DfaLineInput, DfaRenderInput, DfaTotalsInput } from '../../core/contracts';
import { documentTypeCode } from '../../domain/enums/document-type';
import { normalizeEmissionMode } from '../../domain/enums/emission-mode';
import { parseIud } from '../../domain/iud/iud';
import type { AddressData } from '../../domain/value-objects/address-data';
import type { ContactsData } from '../../domain/value-objects/contacts-data';
import type { InvoiceData } from '../../domain/value-objects/invoice-data';
import type { LineItemData } from '../../domain/value-objects/line-item-data';
import type { TotalsData } from '../../domain/value-objects/totals-data';
import type { RenderDfaOptions } from '../efatura-options';

export function dfaRenderInputFrom(options: RenderDfaOptions, qrCodeUrl: string): DfaRenderInput {
  const parsedIud = parseIud(options.iud);

  return {
    iud: options.iud,
    qrCodeUrl,
    title: options.title,
    documentTypeCode: options.invoice ? documentTypeCode(options.invoice.type) : undefined,
    series: options.invoice?.serie ?? undefined,
    documentNumber:
      options.invoice?.innerDocumentNumber ?? trimLeadingZeros(parsedIud.documentNumber),
    issueDate: options.invoice?.issueDate,
    issueTime: options.invoice?.issueTime,
    issuerTaxId: options.invoice?.emitter.taxId?.value,
    issuerName: options.invoice?.emitter.name ?? undefined,
    issuerAddress: addressText(options.invoice?.emitter.address),
    issuerContact: contactText(options.invoice?.emitter.contacts),
    customerTaxId: options.invoice?.receiver?.taxId?.value,
    customerName: options.invoice?.receiver?.name ?? undefined,
    customerAddress: addressText(options.invoice?.receiver?.address),
    customerContact: contactText(options.invoice?.receiver?.contacts),
    lines: options.invoice?.lines.map(dfaLineFrom),
    totals: dfaTotalsFromInvoice(options.invoice),
    total: options.invoice?.totals?.payableAmount,
    currency: options.currency,
    emissionMode: normalizeEmissionMode(options.emissionMode),
    contingencyIuc: options.contingencyIuc ?? options.invoice?.contingency?.iuc ?? undefined,
  };
}

function trimLeadingZeros(value: string): string {
  return String(Number(value));
}

function addressText(address: AddressData | null | undefined): string | undefined {
  return address?.addressDetail;
}

function contactText(contacts: ContactsData | null | undefined): string | undefined {
  return contacts?.email ?? contacts?.mobilephone ?? contacts?.telephone ?? undefined;
}

function dfaLineFrom(line: LineItemData): DfaLineInput {
  return {
    code: line.item.emitterIdentification,
    description: line.item.description,
    quantity: line.quantity.value,
    unitCode: line.quantity.unitCode,
    unitPrice: line.price ?? 0,
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
