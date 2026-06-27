import type { Clock } from '../core/contracts';
import {
  EmissionMode,
  type EmissionModeInput,
  normalizeEmissionMode,
} from '../domain/enums/emission-mode';
import { EfaturaValidationError } from '../domain/errors';

export interface IssueDateValidationInput {
  issueDate: string;
  issueTime?: string | null;
  emissionMode: EmissionModeInput;
  clock: Clock;
}

export function validateIssueDateTolerance(input: IssueDateValidationInput): Date {
  const issuedAt = parseIssueDateTime(input.issueDate, input.issueTime);
  const now = input.clock.now();
  const emissionMode = normalizeEmissionMode(input.emissionMode);

  if (emissionMode === EmissionMode.Online) {
    const lowerBound = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const upperBound = new Date(now.getTime() + 60 * 60 * 1000);

    if (issuedAt < lowerBound || issuedAt > upperBound) {
      throw new EfaturaValidationError(
        'issueDate',
        'Online issue date must be between SFECV time minus 24 hours and plus 1 hour.',
        'issue_date.online_tolerance',
      );
    }

    return issuedAt;
  }

  const contingencyLowerBound = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  if (issuedAt < contingencyLowerBound) {
    throw new EfaturaValidationError(
      'issueDate',
      'Contingency issue date must be within 7 days of SFECV time.',
      'issue_date.contingency_tolerance',
    );
  }

  return issuedAt;
}

export function parseIssueDateTime(issueDate: string, issueTime?: string | null): Date {
  const value = issueDate.includes('T') ? issueDate : `${issueDate}T${issueTime ?? '00:00:00'}`;
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new EfaturaValidationError(
      'issueDate',
      'Issue date must be a valid ISO date or date-time.',
      'issue_date.invalid',
    );
  }

  return parsed;
}
