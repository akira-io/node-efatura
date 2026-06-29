import { describe, expect, it } from 'vitest';
import { fiscalReadinessRequestSchema } from '../src/presentation/shared/schemas';

describe('fiscal readiness request schema', () => {
  it('does not accept a request-supplied baseUrl (SSRF guard)', () => {
    const result = fiscalReadinessRequestSchema.parse({
      invoice: { type: 'FTE' },
      options: { accessToken: 'token', baseUrl: 'http://169.254.169.254/latest' },
    });

    expect('baseUrl' in result.options).toBe(false);
    expect(result.options.accessToken).toBe('token');
  });
});
