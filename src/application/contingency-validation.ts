import {
  EmissionMode,
  type EmissionModeInput,
  normalizeEmissionMode,
} from '../domain/enums/emission-mode';
import { EfaturaValidationError } from '../domain/errors';
import type { InvoiceData } from '../domain/value-objects/invoice-data';

export function assertContingencyMatchesEmissionMode(
  invoice: InvoiceData,
  emissionMode: EmissionModeInput,
): void {
  const normalizedEmissionMode = normalizeEmissionMode(emissionMode);

  if (normalizedEmissionMode === EmissionMode.Online && invoice.contingency !== null) {
    throw new EfaturaValidationError(
      'contingency',
      'Contingency data is not allowed in Online mode.',
      'contingency.not_allowed_online',
    );
  }

  if (normalizedEmissionMode === EmissionMode.Online) {
    return;
  }

  if (invoice.contingency === null) {
    throw new EfaturaValidationError(
      'contingency',
      'Contingency data is required in contingency modes.',
      'contingency.required',
    );
  }

  if (!invoice.contingency.ledCode) {
    throw new EfaturaValidationError(
      'contingency.ledCode',
      'Contingency LedCode is required.',
      'contingency.led_code_required',
    );
  }

  const allowedReasonCodes =
    normalizedEmissionMode === EmissionMode.Offline ? ['0', '1', '4', '5'] : ['0', '2', '3'];

  if (!allowedReasonCodes.includes(invoice.contingency.reasonTypeCode)) {
    throw new EfaturaValidationError(
      'contingency.reasonTypeCode',
      'Contingency ReasonTypeCode is not allowed for this emission mode.',
      'contingency.reason_type_code_invalid',
    );
  }

  if (normalizedEmissionMode === EmissionMode.Offline && invoice.contingency.issueTime === null) {
    throw new EfaturaValidationError(
      'contingency.issueTime',
      'Contingency IssueTime is required in Offline mode.',
      'contingency.issue_time_required',
    );
  }

  if (normalizedEmissionMode === EmissionMode.Off && invoice.contingency.iuc === null) {
    throw new EfaturaValidationError(
      'contingency.iuc',
      'Contingency IUC is required in Off mode.',
      'contingency.iuc_required',
    );
  }

  if (
    invoice.contingency.reasonTypeCode === '0' &&
    invoice.contingency.reasonDescription === null
  ) {
    throw new EfaturaValidationError(
      'contingency.reasonDescription',
      'Contingency ReasonDescription is required when ReasonTypeCode is 0.',
      'contingency.reason_description_required',
    );
  }
}
