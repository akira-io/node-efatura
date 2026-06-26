import type { DocumentTypePolicy } from '../../core/contracts/document-type-policy';
import { messages } from '../../support/messages';
import { isRecord, optionalText, requiredText } from '../../support/normalizers';
import { DocumentType, documentTypeFromValue } from '../enums/document-type';
import { EfaturaValidationError } from '../errors';
import { DefaultDocumentTypePolicy } from '../policies/default-document-type-policy';
import { type LineItemData, lineItemDataFrom } from './line-item-data';
import { type PartyData, partyDataFrom } from './party-data';
import { type TotalsData, totalsDataFrom } from './totals-data';

export interface ContingencyData {
  iuc: string | null;
  reasonTypeCode: string;
  reasonDescription: string | null;
}

export interface InvoiceData {
  id: string | null;
  type: DocumentType;
  issueDate: string;
  issueTime: string | null;
  dueDate: string | null;
  taxPointDate: string | null;
  issueReasonCode: string | null;
  isIsolatedAct: boolean | null;
  serie: string | null;
  emitter: PartyData;
  receiver: PartyData | null;
  payer: PartyData | null;
  lines: LineItemData[];
  totals: TotalsData;
  originalIud: string | null;
  creditNoteReason: string | null;
  debitNoteReason: string | null;
  returnNoteReason: string | null;
  contingency: ContingencyData | null;
  extraFields: Record<string, unknown>;
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

  if (!Array.isArray(data.lines) || data.lines.length === 0) {
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

  if (data.payer !== null && data.payer !== undefined && !isRecord(data.payer)) {
    throw new EfaturaValidationError(
      'payer',
      'Payer must be an object.',
      'validation.payer_invalid',
    );
  }

  if (!isRecord(data.totals)) {
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

  if (type !== DocumentType.ElectronicSalesTicket && data.receiver == null) {
    throw new EfaturaValidationError(
      'receiver',
      messages.invoice.receiverRequiredForType,
      'invoice.receiver_required_for_type',
    );
  }

  return {
    id: optionalText(data.id),
    type,
    issueDate,
    issueTime: optionalText(data.issueTime),
    dueDate: optionalText(data.dueDate),
    taxPointDate: optionalText(data.taxPointDate),
    issueReasonCode: optionalText(data.issueReasonCode),
    isIsolatedAct: optionalBoolean(data.isIsolatedAct),
    serie: optionalText(data.serie),
    emitter: partyDataFrom(data.emitter, 'emitter'),
    receiver: isRecord(data.receiver) ? partyDataFrom(data.receiver, 'receiver') : null,
    payer: isRecord(data.payer) ? partyDataFrom(data.payer, 'payer') : null,
    lines: data.lines
      .filter(isRecord)
      .map((line, index) => lineItemDataFrom(line, `lines.${index}`)),
    totals: totalsDataFrom(data.totals, 'totals'),
    originalIud: optionalText(data.originalIud),
    creditNoteReason: optionalText(data.creditNoteReason),
    debitNoteReason: optionalText(data.debitNoteReason),
    returnNoteReason: optionalText(data.returnNoteReason),
    contingency: contingencyDataFrom(data.contingency),
    extraFields: isRecord(data.extraFields) ? data.extraFields : {},
  };
}

function contingencyDataFrom(value: unknown): ContingencyData | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    iuc: optionalText(value.iuc),
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
