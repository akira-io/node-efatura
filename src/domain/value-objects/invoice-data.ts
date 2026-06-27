import type { DocumentTypePolicy } from '../../core/contracts/document-type-policy';
import { messages } from '../../support/messages';
import { isRecord, optionalText, requiredText } from '../../support/normalizers';
import { DocumentType, documentTypeFromValue } from '../enums/document-type';
import { EfaturaValidationError } from '../errors';
import { DefaultDocumentTypePolicy } from '../policies/default-document-type-policy';
import {
  type DatePeriodData,
  type DeliveryData,
  datePeriodDataFrom,
  deliveryDataFrom,
  type PaymentsData,
  paymentsDataFrom,
  type ReferenceData,
  type RentReceiptData,
  referencesDataFrom,
  rentReceiptDataFrom,
  type SelfBillingData,
  selfBillingDataFrom,
  type TransportRouteData,
  transportRouteDataFrom,
} from './document-structures';
import { type ExtraFieldData, extraFieldsDataFrom } from './extra-fields';
import { assertDocumentFieldCompatibility } from './invoice-field-compatibility';
import { type LineItemData, lineItemDataFrom } from './line-item-data';
import { type PartyData, partyDataFrom } from './party-data';
import { type TotalsData, totalsDataFrom } from './totals-data';

export interface ContingencyData {
  ledCode: string | null;
  iuc: string | null;
  issueDate: string;
  issueTime: string | null;
  reasonTypeCode: string;
  reasonDescription: string | null;
}

export interface InvoiceData {
  id: string | null;
  type: DocumentType;
  issueDate: string;
  issueTime: string | null;
  dueDate: string | null;
  orderReferenceId: string | null;
  taxPointDate: string | null;
  issueReasonCode: string | null;
  issueReasonDescription: string | null;
  isIsolatedAct: boolean | null;
  isSpecimen: boolean | null;
  selfBilling: SelfBillingData | null;
  serie: string | null;
  innerDocumentNumber: string | null;
  rappelPeriod: DatePeriodData | null;
  receiverTypeCode: string | null;
  transportDocumentTypeCode: string | null;
  emitter: PartyData;
  receiver: PartyData | null;
  paymentParty: PartyData | null;
  transportServiceProviderParty: PartyData | null;
  receiptTypeCode: string | null;
  rentReceipt: RentReceiptData | null;
  lines: LineItemData[];
  totals: TotalsData | null;
  references: ReferenceData[];
  payments: PaymentsData | null;
  delivery: DeliveryData | null;
  transportRoute: TransportRouteData | null;
  note: string | null;
  contingency: ContingencyData | null;
  extraFields: ExtraFieldData[];
}

export interface InvoiceValidationOptions {
  documentTypePolicy?: DocumentTypePolicy;
}

export function invoiceDataFrom(
  data: Record<string, unknown>,
  options: InvoiceValidationOptions = {},
): InvoiceData {
  const policy = options.documentTypePolicy ?? new DefaultDocumentTypePolicy();
  const type = documentTypeFromValue(data.type);

  if (type === null) {
    throw new EfaturaValidationError(
      'type',
      messages.validation.invoiceTypeMismatch,
      'validation.invoice_type_mismatch',
    );
  }

  if (!isRecord(data.emitter)) {
    throw new EfaturaValidationError(
      'emitter',
      messages.validation.emitterRequired,
      'validation.emitter_required',
    );
  }

  const issueDate = requiredText(
    data.issueDate,
    'issueDate',
    messages.invoice.issueDateRequired,
    'invoice.issue_date_required',
  );

  if (requiresLines(type) && (!Array.isArray(data.lines) || data.lines.length === 0)) {
    throw new EfaturaValidationError(
      'lines',
      messages.validation.linesRequired,
      'validation.lines_required',
    );
  }

  if (data.receiver !== null && data.receiver !== undefined && !isRecord(data.receiver)) {
    throw new EfaturaValidationError(
      'receiver',
      messages.validation.receiverRequired,
      'validation.receiver_required',
    );
  }

  if (
    data.paymentParty !== null &&
    data.paymentParty !== undefined &&
    !isRecord(data.paymentParty)
  ) {
    throw new EfaturaValidationError(
      'paymentParty',
      'PaymentParty must be an object.',
      'validation.payment_party_invalid',
    );
  }

  if (requiresTotals(type) && !isRecord(data.totals)) {
    throw new EfaturaValidationError(
      'totals',
      messages.validation.totalsRequired,
      'validation.totals_required',
    );
  }

  if (!policy.supportsEmission(type)) {
    throw new EfaturaValidationError(
      'type',
      messages.invoice.documentTypeNotSupported(type),
      'invoice.document_type_not_supported',
    );
  }

  if (requiresReceiver(type) && data.receiver == null) {
    throw new EfaturaValidationError(
      'receiver',
      messages.invoice.receiverRequiredForType,
      'invoice.receiver_required_for_type',
    );
  }

  const invoice: InvoiceData = {
    id: optionalText(data.id),
    type,
    issueDate,
    issueTime: optionalText(data.issueTime),
    dueDate: optionalText(data.dueDate),
    orderReferenceId: optionalText(data.orderReferenceId),
    taxPointDate: optionalText(data.taxPointDate),
    issueReasonCode: optionalText(data.issueReasonCode),
    issueReasonDescription: optionalText(data.issueReasonDescription),
    isIsolatedAct: optionalBoolean(data.isIsolatedAct),
    isSpecimen: optionalBoolean(data.isSpecimen),
    selfBilling: selfBillingDataFrom(data.selfBilling, 'selfBilling'),
    serie: optionalText(data.serie),
    innerDocumentNumber: optionalText(data.innerDocumentNumber),
    rappelPeriod: datePeriodDataFrom(data.rappelPeriod, 'rappelPeriod'),
    receiverTypeCode: optionalText(data.receiverTypeCode),
    transportDocumentTypeCode: optionalText(data.transportDocumentTypeCode),
    emitter: partyDataFrom(data.emitter, 'emitter'),
    receiver: isRecord(data.receiver) ? partyDataFrom(data.receiver, 'receiver') : null,
    paymentParty: isRecord(data.paymentParty)
      ? partyDataFrom(data.paymentParty, 'paymentParty')
      : null,
    transportServiceProviderParty: isRecord(data.transportServiceProviderParty)
      ? partyDataFrom(data.transportServiceProviderParty, 'transportServiceProviderParty')
      : null,
    receiptTypeCode: optionalText(data.receiptTypeCode),
    rentReceipt: rentReceiptDataFrom(data.rentReceipt, 'rentReceipt'),
    lines: arrayOfRecords(data.lines)
      .filter(isRecord)
      .map((line, index) => lineItemDataFrom(line, `lines.${index}`)),
    totals: isRecord(data.totals) ? totalsDataFrom(data.totals, 'totals') : null,
    references: referencesDataFrom(data.references, 'references'),
    payments: paymentsDataFrom(data.payments, 'payments'),
    delivery: deliveryDataFrom(data.delivery, 'delivery'),
    transportRoute: transportRouteDataFrom(data.transportRoute, 'transportRoute'),
    note: optionalText(data.note),
    contingency: contingencyDataFrom(data.contingency),
    extraFields: extraFieldsDataFrom(data.extraFields, 'extraFields'),
  };

  assertDocumentFieldCompatibility(invoice);

  return invoice;
}

function contingencyDataFrom(value: unknown): ContingencyData | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    ledCode: optionalText(value.ledCode),
    iuc: optionalText(value.iuc),
    issueDate: requiredText(
      value.issueDate,
      'contingency.issueDate',
      'Contingency issue date is required.',
      'contingency.issue_date_required',
    ),
    issueTime: optionalText(value.issueTime),
    reasonTypeCode: requiredText(
      value.reasonTypeCode,
      'contingency.reasonTypeCode',
      'Contingency reason type code is required.',
      'contingency.reason_type_code_required',
    ),
    reasonDescription: optionalText(value.reasonDescription),
  };
}

function optionalBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return null;
}

function requiresTotals(type: DocumentType): boolean {
  return (
    type !== DocumentType.ElectronicReceipt && type !== DocumentType.ElectronicTransportDocument
  );
}

function requiresLines(type: DocumentType): boolean {
  return type !== DocumentType.ElectronicReceipt;
}

function requiresReceiver(type: DocumentType): boolean {
  return (
    type !== DocumentType.ElectronicSalesTicket &&
    type !== DocumentType.ElectronicTransportDocument &&
    type !== DocumentType.ElectronicReturnNote
  );
}

function arrayOfRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}
