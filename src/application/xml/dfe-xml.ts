import type { ResolvedEfaturaConfig } from '../../config';
import { DocumentType, documentTypeCode } from '../../domain/enums/document-type';
import type { EmissionModeInput } from '../../domain/enums/emission-mode';
import { EfaturaValidationError } from '../../domain/errors';
import { parseIud, validateIud } from '../../domain/iud/iud';
import type { InvoiceData } from '../../domain/value-objects/invoice-data';
import {
  assertEmitter,
  datePeriodXml,
  deliveryXml,
  element,
  escapeAttribute,
  escapeXml,
  footerXml,
  linesXml,
  optionalPartyXml,
  orderReferenceXml,
  partyXml,
  paymentsForTypeXml,
  paymentsInvoiceXml,
  paymentsPaymentXml,
  referencesXml,
  rentReceiptXml,
  requiredParty,
  requiredValue,
  selfBillingXml,
  totalsXml,
  transmissionXml,
  transportRouteXml,
} from './dfe-xml-fragments';

export const DFE_NAMESPACE = 'urn:cv:efatura:xsd:v1.0';
export const DFE_XML_VERSION = '1.0';

export type { EmissionMode, EmissionModeInput } from '../../domain/enums/emission-mode';

export interface BuildDfeXmlInput {
  iud: string;
  invoice: InvoiceData;
  config: ResolvedEfaturaConfig;
  emissionMode?: EmissionModeInput;
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

  assertEmitter(input.invoice.emitter);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<Dfe xmlns="${DFE_NAMESPACE}" Version="${DFE_XML_VERSION}" Id="${escapeAttribute(
      input.iud,
    )}" DocumentTypeCode="${documentTypeCode(input.invoice.type)}">`,
    element('IsSpecimen', input.invoice.isSpecimen === true ? true : null),
    documentXml(input),
    transmissionXml({
      config: input.config,
      emissionMode: input.emissionMode,
      contingency: input.invoice.contingency,
    }),
    element('RepositoryCode', input.config.repositoryCode),
    '</Dfe>',
  ].join('');
}

export function dfeDocumentElementName(type: DocumentType): string {
  return DOCUMENT_ROOTS[type];
}

export { escapeXml };

function documentXml(input: BuildDfeXmlInput): string {
  const documentNumber = parseIud(input.iud).documentNumber;
  const root = dfeDocumentElementName(input.invoice.type);
  const content = documentContentXml(input.invoice, input.config, documentNumber);

  return `<${root}>${content}</${root}>`;
}

function documentContentXml(
  invoice: InvoiceData,
  config: ResolvedEfaturaConfig,
  documentNumber: string,
): string {
  if (invoice.type === DocumentType.ElectronicInvoice) {
    return invoiceXml(invoice, config, documentNumber);
  }

  if (invoice.type === DocumentType.ElectronicInvoiceReceipt) {
    return invoiceReceiptXml(invoice, config, documentNumber);
  }

  if (invoice.type === DocumentType.ElectronicSalesTicket) {
    return salesReceiptXml(invoice, config, documentNumber);
  }

  if (invoice.type === DocumentType.ElectronicTransportDocument) {
    return transportXml(invoice, config, documentNumber);
  }

  if (invoice.type === DocumentType.ElectronicReceipt) {
    return receiptXml(invoice, config, documentNumber);
  }

  if (invoice.type === DocumentType.ElectronicCreditNote) {
    return creditNoteXml(invoice, config, documentNumber);
  }

  if (invoice.type === DocumentType.ElectronicDebitNote) {
    return debitNoteXml(invoice, config, documentNumber);
  }

  if (invoice.type === DocumentType.ElectronicReturnNote) {
    return returnNoteXml(invoice, config, documentNumber);
  }

  return registrationNoteXml(invoice, config, documentNumber);
}

function invoiceXml(
  invoice: InvoiceData,
  config: ResolvedEfaturaConfig,
  documentNumber: string,
): string {
  return `${headerXml(invoice, config, documentNumber)}${element('DueDate', invoice.dueDate)}${orderReferenceXml(
    invoice.orderReferenceId,
  )}${element('TaxPointDate', invoice.taxPointDate)}${partyXml(
    'EmitterParty',
    invoice.emitter,
  )}${partyXml('ReceiverParty', requiredParty(invoice.receiver, 'receiver'))}${linesTotalsXml(
    invoice,
  )}${referencesXml(invoice.references)}${paymentsInvoiceXml(invoice.payments)}${deliveryXml(
    invoice.delivery,
  )}${footerXml(invoice)}`;
}

function invoiceReceiptXml(
  invoice: InvoiceData,
  config: ResolvedEfaturaConfig,
  documentNumber: string,
): string {
  return `${headerXml(invoice, config, documentNumber)}${orderReferenceXml(
    invoice.orderReferenceId,
  )}${element('TaxPointDate', invoice.taxPointDate)}${partyXml(
    'EmitterParty',
    invoice.emitter,
  )}${partyXml('ReceiverParty', requiredParty(invoice.receiver, 'receiver'))}${optionalPartyXml(
    'PaymentParty',
    invoice.paymentParty,
  )}${linesTotalsXml(invoice)}${referencesXml(invoice.references)}${paymentsPaymentXml(
    invoice.payments,
  )}${deliveryXml(invoice.delivery)}${footerXml(invoice)}`;
}

function salesReceiptXml(
  invoice: InvoiceData,
  config: ResolvedEfaturaConfig,
  documentNumber: string,
): string {
  return `${headerXml(invoice, config, documentNumber)}${partyXml('EmitterParty', invoice.emitter)}${
    invoice.receiver ? partyXml('ReceiverParty', invoice.receiver) : ''
  }${linesTotalsXml(invoice)}${paymentsPaymentXml(invoice.payments)}${deliveryXml(
    invoice.delivery,
  )}${footerXml(invoice)}`;
}

function transportXml(
  invoice: InvoiceData,
  config: ResolvedEfaturaConfig,
  documentNumber: string,
): string {
  return `${headerXml(invoice, config, documentNumber)}${element(
    'ReceiverTypeCode',
    invoice.receiverTypeCode,
  )}${element(
    'TransportDocumentTypeCode',
    requiredValue(invoice.transportDocumentTypeCode, 'transportDocumentTypeCode'),
  )}${partyXml('EmitterParty', invoice.emitter)}${
    invoice.receiver ? partyXml('ReceiverParty', invoice.receiver) : ''
  }${partyXml(
    'TransportServiceProviderParty',
    requiredParty(invoice.transportServiceProviderParty, 'transportServiceProviderParty'),
  )}${linesXml(invoice.lines)}${transportRouteXml(
    requiredValue(invoice.transportRoute, 'transportRoute'),
  )}${referencesXml(invoice.references)}${footerXml(invoice)}`;
}

function receiptXml(
  invoice: InvoiceData,
  config: ResolvedEfaturaConfig,
  documentNumber: string,
): string {
  return `${headerXml(invoice, config, documentNumber)}${partyXml(
    'EmitterParty',
    invoice.emitter,
  )}${partyXml('ReceiverParty', requiredParty(invoice.receiver, 'receiver'))}${optionalPartyXml(
    'PaymentParty',
    invoice.paymentParty,
  )}${element('ReceiptTypeCode', requiredValue(invoice.receiptTypeCode, 'receiptTypeCode'))}${rentReceiptXml(
    invoice.rentReceipt,
  )}${referencesXml(invoice.references)}${paymentsPaymentXml(invoice.payments)}${footerXml(invoice)}`;
}

function creditNoteXml(
  invoice: InvoiceData,
  config: ResolvedEfaturaConfig,
  documentNumber: string,
): string {
  return `${headerXml(invoice, config, documentNumber)}${element(
    'IssueReasonCode',
    requiredValue(invoice.issueReasonCode, 'issueReasonCode'),
  )}${datePeriodXml('RappelPeriod', invoice.rappelPeriod)}${partyXml(
    'EmitterParty',
    invoice.emitter,
  )}${partyXml('ReceiverParty', requiredParty(invoice.receiver, 'receiver'))}${linesTotalsXml(
    invoice,
  )}${referencesXml(invoice.references)}${footerXml(invoice)}`;
}

function debitNoteXml(
  invoice: InvoiceData,
  config: ResolvedEfaturaConfig,
  documentNumber: string,
): string {
  return `${headerXml(invoice, config, documentNumber)}${element(
    'IssueReasonCode',
    requiredValue(invoice.issueReasonCode, 'issueReasonCode'),
  )}${partyXml('EmitterParty', invoice.emitter)}${partyXml(
    'ReceiverParty',
    requiredParty(invoice.receiver, 'receiver'),
  )}${linesTotalsXml(invoice)}${referencesXml(invoice.references)}${footerXml(invoice)}`;
}

function returnNoteXml(
  invoice: InvoiceData,
  config: ResolvedEfaturaConfig,
  documentNumber: string,
): string {
  return `${headerXml(invoice, config, documentNumber)}${element(
    'IssueReasonCode',
    requiredValue(invoice.issueReasonCode, 'issueReasonCode'),
  )}${element('IssueReasonDescription', invoice.issueReasonDescription)}${partyXml(
    'EmitterParty',
    invoice.emitter,
  )}${invoice.receiver ? partyXml('ReceiverParty', invoice.receiver) : ''}${linesTotalsXml(
    invoice,
  )}${referencesXml(invoice.references)}${footerXml(invoice)}`;
}

function registrationNoteXml(
  invoice: InvoiceData,
  config: ResolvedEfaturaConfig,
  documentNumber: string,
): string {
  return `${headerXml(invoice, config, documentNumber)}${partyXml(
    'EmitterParty',
    invoice.emitter,
  )}${partyXml('ReceiverParty', requiredParty(invoice.receiver, 'receiver'))}${optionalPartyXml(
    'PaymentParty',
    invoice.paymentParty,
  )}${linesTotalsXml(invoice)}${referencesXml(invoice.references)}${paymentsForTypeXml(
    invoice,
  )}${footerXml(invoice)}`;
}

function headerXml(
  invoice: InvoiceData,
  config: ResolvedEfaturaConfig,
  documentNumber: string,
): string {
  return [
    element('IsIsolatedAct', invoice.isIsolatedAct),
    selfBillingXml(invoice.selfBilling),
    element('LedCode', config.transmitterLed),
    element('Serie', invoice.serie ?? config.transmitterLed),
    element('DocumentNumber', documentNumber),
    element('InnerDocumentNumber', invoice.innerDocumentNumber),
    element('IssueDate', invoice.issueDate),
    element('IssueTime', requiredValue(invoice.issueTime, 'issueTime')),
  ].join('');
}

function linesTotalsXml(invoice: InvoiceData): string {
  return `${linesXml(invoice.lines)}${totalsXml(requiredValue(invoice.totals, 'totals'))}`;
}
