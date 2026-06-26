import type { ResolvedEfaturaConfig } from '../../config';
import { DocumentType, documentTypeCode } from '../../domain/enums/document-type';
import { EfaturaValidationError } from '../../domain/errors';
import { parseIud, validateIud } from '../../domain/iud/iud';
import type { ContingencyData, InvoiceData } from '../../domain/value-objects/invoice-data';
import type { LineItemData } from '../../domain/value-objects/line-item-data';
import type { PartyData } from '../../domain/value-objects/party-data';
import type { TaxData } from '../../domain/value-objects/tax-data';
import type { TotalsData } from '../../domain/value-objects/totals-data';

export const DFE_NAMESPACE = 'urn:cv:efatura:xsd:v1.0';
export const DFE_XML_VERSION = '1.0';

export type EmissionMode = 'Online' | 'Offline' | 'Off';

export interface BuildDfeXmlInput {
  iud: string;
  invoice: InvoiceData;
  config: ResolvedEfaturaConfig;
  emissionMode?: EmissionMode;
}

const DOCUMENT_ROOTS: Record<DocumentType, string> = {
  [DocumentType.ElectronicInvoice]: 'Invoice',
  [DocumentType.ElectronicInvoiceReceipt]: 'InvoiceReceipt',
  [DocumentType.ElectronicSalesTicket]: 'SalesReceipt',
  [DocumentType.ElectronicReceipt]: 'Receipt',
  [DocumentType.ElectronicCreditNote]: 'CreditNote',
  [DocumentType.ElectronicDebitNote]: 'DebitNote',
  [DocumentType.ElectronicReturnNote]: 'ReturnNote',
  [DocumentType.ElectronicEntryNote]: 'RegistrationNote',
  [DocumentType.ElectronicTransportDocument]: 'Transport',
};

export function buildDfeXml(input: BuildDfeXmlInput): string {
  if (!validateIud(input.iud)) {
    throw new EfaturaValidationError('iud', 'IUD is invalid.', 'xml.iud_invalid');
  }

  assertEmitterContacts(input.invoice.emitter);

  const documentTypeCodeValue = documentTypeCode(input.invoice.type);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<Dfe xmlns="${DFE_NAMESPACE}" Version="${DFE_XML_VERSION}" Id="${escapeAttribute(
      input.iud,
    )}" DocumentTypeCode="${documentTypeCodeValue}">`,
    documentXml(input),
    '</Dfe>',
  ].join('');
}

export function dfeDocumentElementName(type: DocumentType): string {
  return DOCUMENT_ROOTS[type];
}

export function escapeXml(value: string | number | boolean): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function documentXml(input: BuildDfeXmlInput): string {
  const parsedIud = parseIud(input.iud);
  const root = dfeDocumentElementName(input.invoice.type);
  const emissionMode = input.emissionMode ?? 'Online';

  return `<${root}>${identificationXml(
    input.invoice,
    input.config,
    parsedIud.documentNumber,
    emissionMode,
  )}${softwareXml(input.config)}${partyXml('Emitter', input.invoice.emitter)}${
    input.invoice.receiver ? partyXml('Receiver', input.invoice.receiver) : ''
  }${input.invoice.payer ? partyXml('Payer', input.invoice.payer) : ''}${linesXml(
    input.invoice.lines,
  )}${totalsXml(input.invoice.totals)}${referenceXml(input.invoice)}${contingencyXml(
    input.invoice.contingency,
    emissionMode,
    input.config,
  )}${extraFieldsXml(input.invoice.extraFields)}</${root}>`;
}

function escapeAttribute(value: string | number | boolean): string {
  return escapeXml(value);
}

function element(name: string, value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  return `<${name}>${escapeXml(value)}</${name}>`;
}

function identificationXml(
  invoice: InvoiceData,
  config: ResolvedEfaturaConfig,
  documentNumber: string,
  emissionMode: EmissionMode,
): string {
  return `<Identification>${element('LedCode', config.transmitterLed)}${element(
    'Serie',
    invoice.serie ?? config.transmitterLed,
  )}${element('DocumentNumber', documentNumber)}${element('IssueDate', invoice.issueDate)}${element(
    'IssueTime',
    invoice.issueTime,
  )}${element('IssueMode', emissionMode.toUpperCase())}${element('DueDate', invoice.dueDate)}${element(
    'TaxPointDate',
    invoice.taxPointDate,
  )}${element('IssueReasonCode', invoice.issueReasonCode)}${element(
    'IsIsolatedAct',
    invoice.isIsolatedAct,
  )}</Identification>`;
}

function softwareXml(config: ResolvedEfaturaConfig): string {
  return `<Software>${element('Code', config.softwareCode)}${element(
    'Name',
    config.softwareName,
  )}${element('Version', config.softwareVersion)}</Software>`;
}

function partyXml(name: 'Emitter' | 'Receiver' | 'Payer', party: PartyData): string {
  return `<${name}>${element('NIF', party.nif)}${element('Name', party.name)}${element(
    'Address',
    party.address,
  )}${element('City', party.city)}${element('Country', party.country)}${element(
    'Email',
    party.email,
  )}${element('Phone', party.phone)}</${name}>`;
}

function linesXml(lines: LineItemData[]): string {
  return `<Lines>${lines.map(lineXml).join('')}</Lines>`;
}

function lineXml(line: LineItemData): string {
  return `<Line>${element('Description', line.description)}${element(
    'Quantity',
    line.quantity,
  )}${element('UnitPrice', line.unitPrice)}${element('Total', line.total)}${taxesXml(
    line.taxes,
  )}</Line>`;
}

function taxesXml(taxes: TaxData[]): string {
  if (taxes.length === 0) {
    return '';
  }

  return `<Taxes>${taxes.map(taxXml).join('')}</Taxes>`;
}

function taxXml(tax: TaxData): string {
  return `<Tax>${element('TaxTypeCode', tax.type)}${element('Rate', tax.rate)}${element(
    'Amount',
    tax.amount,
  )}${element('TaxExemptionReasonCode', tax.exemptionReason)}</Tax>`;
}

function totalsXml(totals: TotalsData): string {
  return `<Totals>${element('Subtotal', totals.subtotal)}${element(
    'TaxTotal',
    totals.taxTotal,
  )}${element('GrandTotal', totals.grandTotal)}</Totals>`;
}

function referenceXml(invoice: InvoiceData): string {
  const reason = invoice.creditNoteReason ?? invoice.debitNoteReason ?? invoice.returnNoteReason;

  if (!invoice.originalIud && !reason) {
    return '';
  }

  return `<Reference>${element('OriginalIUD', invoice.originalIud)}${element(
    'Reason',
    reason,
  )}</Reference>`;
}

function contingencyXml(
  contingency: ContingencyData | null,
  emissionMode: EmissionMode,
  config: ResolvedEfaturaConfig,
): string {
  if (emissionMode === 'Online') {
    return '';
  }

  if (!contingency) {
    throw new EfaturaValidationError(
      'contingency',
      'Contingency data is required for Offline and Off emission modes.',
      'contingency.required',
    );
  }

  return `<Contingency>${element('LedCode', config.transmitterLed)}${element(
    'IUC',
    contingency.iuc,
  )}${element('ReasonTypeCode', contingency.reasonTypeCode)}${element(
    'ReasonDescription',
    contingency.reasonDescription,
  )}</Contingency>`;
}

function extraFieldsXml(fields: Record<string, unknown>): string {
  return Object.entries(fields)
    .map(([name, value]) => valueXml(name, value))
    .join('');
}

function valueXml(name: string, value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (Array.isArray(value)) {
    return value.map((item) => valueXml(name, item)).join('');
  }

  if (typeof value === 'object') {
    return `<${name}>${extraFieldsXml(value as Record<string, unknown>)}</${name}>`;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return element(name, value);
  }

  return '';
}

function assertEmitterContacts(emitter: PartyData): void {
  if (!emitter.email) {
    throw new EfaturaValidationError(
      'emitter.email',
      'Emitter email is required for e-Fatura v11.0 XML.',
      'xml.emitter_email_required',
    );
  }

  if (!emitter.phone) {
    throw new EfaturaValidationError(
      'emitter.phone',
      'Emitter phone is required for e-Fatura v11.0 XML.',
      'xml.emitter_phone_required',
    );
  }
}
