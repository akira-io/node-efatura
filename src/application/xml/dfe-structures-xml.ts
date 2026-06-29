import type { ResolvedEfaturaConfig } from '../../config';
import {
  EmissionMode,
  type EmissionModeInput,
  normalizeEmissionMode,
} from '../../domain/enums/emission-mode';
import { EfaturaValidationError } from '../../domain/errors';
import type {
  DatePeriodData,
  DeliveryData,
  FiscalDocumentData,
  PayeeFinancialAccountData,
  PaymentsData,
  ReferenceData,
  RentReceiptData,
  TransportRouteData,
} from '../../domain/value-objects/document-structures';
import type { ExtraFieldData, ExtraFieldScalar } from '../../domain/value-objects/extra-fields';
import type { ContingencyData, InvoiceData } from '../../domain/value-objects/invoice-data';
import { taxXml } from './dfe-lines-xml';
import { addressXml } from './dfe-party-xml';
import { element, escapeXml, requiredValue } from './xml-core';

const XML_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

function assertXmlName(name: string): string {
  if (!XML_NAME_PATTERN.test(name)) {
    throw new EfaturaValidationError(
      'extraFields.name',
      'Extra field name is not a valid XML name.',
      'extra_fields.xml_name_invalid',
    );
  }

  return name;
}

export interface TransmissionXmlInput {
  config: ResolvedEfaturaConfig;
  emissionMode?: EmissionModeInput;
  contingency?: ContingencyData | null;
}

export function selfBillingXml(selfBilling: InvoiceData['selfBilling']): string {
  if (!selfBilling) {
    return '';
  }

  return `<SelfBilling>${element('AuthorizationId', selfBilling.authorizationId)}${element(
    'AuthorizationCode',
    selfBilling.authorizationCode,
  )}</SelfBilling>`;
}

export function orderReferenceXml(id: string | null): string {
  return id ? `<OrderReference>${element('Id', id)}</OrderReference>` : '';
}

export function referencesXml(references: ReferenceData[]): string {
  return references.length === 0
    ? ''
    : `<References>${references.map(referenceXml).join('')}</References>`;
}

export function paymentsInvoiceXml(payments: PaymentsData | null): string {
  if (!payments) {
    return '';
  }

  return `<Payments>${element('PaymentDueDate', payments.paymentDueDate)}${paymentTermsXml(
    payments.paymentTermsNote,
  )}${payments.payeeFinancialAccounts.map(payeeFinancialAccountXml).join('')}</Payments>`;
}

export function paymentsPaymentXml(payments: PaymentsData | null): string {
  if (!payments || payments.payments.length === 0) {
    return '';
  }

  return `<Payments>${payments.payments
    .map(
      (payment) =>
        `<Payment>${element('PaymentMeansCode', payment.paymentMeansCode)}${element(
          'PaymentReference',
          payment.paymentReference,
        )}${element('PaymentDate', payment.paymentDate)}${element(
          'PaymentAmount',
          payment.paymentAmount,
        )}${payeeFinancialAccountXml(payment.payeeFinancialAccount)}</Payment>`,
    )
    .join('')}</Payments>`;
}

export function deliveryXml(delivery: DeliveryData | null): string {
  return delivery
    ? `<Delivery>${element('DeliveryDate', delivery.deliveryDate)}${addressXml(
        delivery.address,
      )}</Delivery>`
    : '';
}

export function rentReceiptXml(rentReceipt: RentReceiptData | null): string {
  if (!rentReceipt) {
    return '';
  }

  return `<RentReceipt>${element('AssetId', rentReceipt.assetId)}${element(
    'RentPurposeTypeCode',
    rentReceipt.rentPurposeTypeCode,
  )}${element('ContractTypeCode', rentReceipt.contractTypeCode)}${element(
    'RentTypeCode',
    rentReceipt.rentTypeCode,
  )}${element('ReferencePeriod', rentReceipt.referencePeriod)}${addressXml(
    rentReceipt.address,
  )}</RentReceipt>`;
}

export function transportRouteXml(route: TransportRouteData): string {
  return `<TransportRoute>${route.locations
    .map(
      (location) =>
        `<TransportLocation>${addressXml(location.address)}<Duration>${element(
          'StartDate',
          location.duration.startDate,
        )}${element('StartTime', location.duration.startTime)}${element(
          'EndDate',
          location.duration.endDate,
        )}${element('EndTime', location.duration.endTime)}</Duration>${element(
          'TransportModeCode',
          location.transportModeCode,
        )}${element('VehicleRegistrationCode', location.vehicleRegistrationCode)}</TransportLocation>`,
    )
    .join('')}</TransportRoute>`;
}

export function paymentsForTypeXml(invoice: InvoiceData): string {
  return invoice.type === 'FRE' || invoice.type === 'TVE' || invoice.type === 'NLE'
    ? paymentsPaymentXml(invoice.payments)
    : '';
}

export function datePeriodXml(name: string, period: DatePeriodData | null): string {
  return period
    ? `<${name}>${element('StartDate', period.startDate)}${element('EndDate', period.endDate)}</${name}>`
    : '';
}

export function transmissionXml(input: TransmissionXmlInput): string {
  const mode = normalizeEmissionMode(input.emissionMode);

  return `<Transmission>${element('IssueMode', issueModeCode(mode))}<TransmitterTaxId CountryCode="CV">${escapeXml(
    input.config.transmitterNif,
  )}</TransmitterTaxId>${softwareXml(input.config)}${contingencyXml(
    input.contingency ?? null,
    mode,
  )}</Transmission>`;
}

export function footerXml(invoice: InvoiceData): string {
  return `${element('Note', invoice.note)}${extraFieldsXml(invoice.extraFields)}`;
}

function referenceXml(reference: ReferenceData): string {
  return `<Reference>${fiscalDocumentXml(reference.fiscalDocument)}${element(
    'InnerDocumentNumber',
    reference.innerDocumentNumber,
  )}${element('PaymentAmount', reference.paymentAmount)}${
    reference.tax ? taxXml(reference.tax) : ''
  }</Reference>`;
}

function fiscalDocumentXml(document: FiscalDocumentData | null): string {
  if (!document) {
    return '';
  }

  const old = document.isOldDocument === null ? '' : ` IsOldDocument="${document.isOldDocument}"`;

  return `<FiscalDocument${old}>${escapeXml(document.value)}</FiscalDocument>`;
}

function paymentTermsXml(note: string | null): string {
  return note ? `<PaymentTerms>${element('Note', note)}</PaymentTerms>` : '';
}

function payeeFinancialAccountXml(account: PayeeFinancialAccountData | null): string {
  if (!account) {
    return '';
  }

  return `<PayeeFinancialAccount>${element('AccountNumber', account.accountNumber)}${element(
    'NIB',
    account.accountNumber ? null : account.nib,
  )}${element('Name', account.name)}</PayeeFinancialAccount>`;
}

function softwareXml(config: ResolvedEfaturaConfig): string {
  return `<Software>${element('Code', config.softwareCode)}${element('Name', config.softwareName)}${element(
    'Version',
    config.softwareVersion,
  )}</Software>`;
}

function contingencyXml(contingency: ContingencyData | null, mode: EmissionMode): string {
  if (mode === EmissionMode.Online) {
    return '';
  }

  const data = requiredValue(contingency, 'contingency');

  return `<Contingency>${element('LedCode', data.ledCode)}${element('IUC', data.iuc)}${element(
    'IssueDate',
    data.issueDate,
  )}${element('IssueTime', data.issueTime)}${element('ReasonTypeCode', data.reasonTypeCode)}${element(
    'ReasonDescription',
    data.reasonDescription,
  )}</Contingency>`;
}

function extraFieldsXml(fields: ExtraFieldData[]): string {
  const content = fields.map(extraFieldXml).join('');

  return content ? `<ExtraFields>${content}</ExtraFields>` : '';
}

function extraFieldXml(field: ExtraFieldData): string {
  const name = assertXmlName(field.name);
  const attributes = Object.entries(field.attributes)
    .map(([attributeName, value]) => ` ${assertXmlName(attributeName)}="${escapeXml(value)}"`)
    .join('');
  const content =
    field.children.length > 0 ? field.children.map(extraFieldXml).join('') : scalarXml(field.value);

  return `<${name}${attributes}>${content}</${name}>`;
}

function scalarXml(value: ExtraFieldScalar | null): string {
  return value === null ? '' : escapeXml(value);
}

function issueModeCode(mode: EmissionMode): number {
  if (mode === EmissionMode.Offline) {
    return 2;
  }

  if (mode === EmissionMode.Off) {
    return 3;
  }

  return 1;
}
