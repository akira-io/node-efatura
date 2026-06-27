import { EfaturaValidationError } from '../errors';

export interface BuildEventIdInput {
  repositoryCode: number | string;
  issueDateTime: string;
  transmitterNif: number | string;
}

export interface ParsedEventId {
  countryCode: 'CV';
  repositoryCode: string;
  issueDate: string;
  issueTime: string;
  transmitterNif: string;
}

const EVENT_ID_PATTERN =
  /^CV(?<repositoryCode>\d)(?<year>\d{2})(?<month>0[1-9]|1[0-2])(?<day>0[1-9]|[12]\d|3[01])(?<time>\d{6})(?<transmitterNif>[1-9]\d{8})$/;

export function buildEventId(input: BuildEventIdInput): string {
  const repositoryCode = String(input.repositoryCode);

  if (!/^[123]$/.test(repositoryCode)) {
    throw new EfaturaValidationError(
      'repositoryCode',
      'RepositoryCode must be 1, 2, or 3.',
      'event.repository_code_invalid',
    );
  }

  const match =
    /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})T(?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2})/.exec(
      input.issueDateTime,
    );

  if (!match?.groups) {
    throw new EfaturaValidationError(
      'issueDateTime',
      'IssueDateTime must be an ISO date-time.',
      'event.issue_date_time_invalid',
    );
  }

  const { year, month, day, hour, minute, second } = requiredEventDateTimeGroups(match.groups);
  const transmitterNif = String(input.transmitterNif);

  if (!/^[1-9]\d{8}$/.test(transmitterNif)) {
    throw new EfaturaValidationError(
      'transmitterNif',
      'Transmitter NIF must have 9 digits and cannot start with zero.',
      'event.transmitter_nif_invalid',
    );
  }

  return `CV${repositoryCode}${year.slice(2)}${month}${day}${hour}${minute}${second}${transmitterNif}`;
}

export function validateEventId(value: string): boolean {
  return EVENT_ID_PATTERN.test(value);
}

export function parseEventId(value: string): ParsedEventId {
  const match = EVENT_ID_PATTERN.exec(value);

  if (!match?.groups) {
    throw new EfaturaValidationError('eventId', 'Event Id is invalid.', 'event.id_invalid');
  }

  const groups = requiredEventIdGroups(match.groups);

  return {
    countryCode: 'CV',
    repositoryCode: groups.repositoryCode,
    issueDate: `20${groups.year}-${groups.month}-${groups.day}`,
    issueTime: `${groups.time.slice(0, 2)}:${groups.time.slice(2, 4)}:${groups.time.slice(4, 6)}`,
    transmitterNif: groups.transmitterNif,
  };
}

function requiredEventDateTimeGroups(groups: Record<string, string | undefined>): {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
} {
  const { year, month, day, hour, minute, second } = groups;

  if (!year || !month || !day || !hour || !minute || !second) {
    throw new EfaturaValidationError(
      'issueDateTime',
      'IssueDateTime must be an ISO date-time.',
      'event.issue_date_time_invalid',
    );
  }

  return { year, month, day, hour, minute, second };
}

function requiredEventIdGroups(groups: Record<string, string | undefined>): {
  repositoryCode: string;
  year: string;
  month: string;
  day: string;
  time: string;
  transmitterNif: string;
} {
  const { repositoryCode, year, month, day, time, transmitterNif } = groups;

  if (!repositoryCode || !year || !month || !day || !time || !transmitterNif) {
    throw new EfaturaValidationError('eventId', 'Event Id is invalid.', 'event.id_invalid');
  }

  return { repositoryCode, year, month, day, time, transmitterNif };
}
