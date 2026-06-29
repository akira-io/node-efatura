import { describe, expect, it } from 'vitest';
import {
  parseIssueDateTime,
  validateIssueDateTolerance,
} from '../src/application/issue-date-validation';
import { EmissionMode } from '../src/domain/enums/emission-mode';
import { EfaturaValidationError } from '../src/domain/errors';

const clock = { now: () => new Date('2026-02-08T12:00:00Z') };

function expectCode(callback: () => unknown, code: string): void {
  try {
    callback();
    throw new Error('Expected validation to fail.');
  } catch (error) {
    expect(error).toBeInstanceOf(EfaturaValidationError);
    expect((error as EfaturaValidationError).code).toBe(code);
  }
}

describe('issue date tolerance', () => {
  it('interprets a bare datetime in Cabo Verde time (UTC-1), independent of host timezone', () => {
    expect(parseIssueDateTime('2026-02-08', '10:30:00').toISOString()).toBe(
      '2026-02-08T11:30:00.000Z',
    );
  });

  it('honours an explicit timezone designator when present', () => {
    expect(parseIssueDateTime('2026-02-08T10:30:00Z').toISOString()).toBe(
      '2026-02-08T10:30:00.000Z',
    );
  });

  it('accepts the online upper boundary (SFECV + 1h) and rejects one second past it', () => {
    expect(() =>
      validateIssueDateTolerance({
        issueDate: '2026-02-08',
        issueTime: '12:00:00',
        emissionMode: EmissionMode.Online,
        clock,
      }),
    ).not.toThrow();

    expectCode(
      () =>
        validateIssueDateTolerance({
          issueDate: '2026-02-08',
          issueTime: '12:00:01',
          emissionMode: EmissionMode.Online,
          clock,
        }),
      'issue_date.online_tolerance',
    );
  });

  it('accepts the online lower boundary (SFECV - 24h) and rejects one second before it', () => {
    expect(() =>
      validateIssueDateTolerance({
        issueDate: '2026-02-07',
        issueTime: '11:00:00',
        emissionMode: EmissionMode.Online,
        clock,
      }),
    ).not.toThrow();

    expectCode(
      () =>
        validateIssueDateTolerance({
          issueDate: '2026-02-07',
          issueTime: '10:59:59',
          emissionMode: EmissionMode.Online,
          clock,
        }),
      'issue_date.online_tolerance',
    );
  });

  it('accepts the contingency lower boundary (SFECV - 7 days) and rejects one second before it', () => {
    expect(() =>
      validateIssueDateTolerance({
        issueDate: '2026-02-01',
        issueTime: '11:00:00',
        emissionMode: EmissionMode.Offline,
        clock,
      }),
    ).not.toThrow();

    expectCode(
      () =>
        validateIssueDateTolerance({
          issueDate: '2026-02-01',
          issueTime: '10:59:59',
          emissionMode: EmissionMode.Offline,
          clock,
        }),
      'issue_date.contingency_tolerance',
    );
  });
});
