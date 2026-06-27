import { EfaturaValidationError } from '../domain/errors';
import type { InvoiceData } from '../domain/value-objects/invoice-data';
import type { EmissionMode } from './xml/dfe-xml';

export function assertContingencyMatchesEmissionMode(
  invoice: InvoiceData,
  emissionMode: EmissionMode,
): void {
  if (emissionMode === 'Online' && invoice.contingency !== null) {
    throw new EfaturaValidationError(
      'contingency',
      'Contingency data is not allowed in Online mode.',
      'contingency.not_allowed_online',
    );
  }

  if (emissionMode === 'Online') {
    return;
  }

  if (invoice.contingency === null) {
    throw new EfaturaValidationError(
      'contingency',
      'Contingency data is required in contingency modes.',
      'contingency.required',
    );
  }

  const allowedReasonCodes = emissionMode === 'Offline' ? ['0', '1', '4', '5'] : ['0', '2', '3'];

  if (!allowedReasonCodes.includes(invoice.contingency.reasonTypeCode)) {
    throw new EfaturaValidationError(
      'contingency.reasonTypeCode',
      'Contingency ReasonTypeCode is not allowed for this emission mode.',
      'contingency.reason_type_code_invalid',
    );
  }
}
