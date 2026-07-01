import { describe, expect, it } from 'vitest';
import { handleRenderDfaFromBody } from '../src/presentation/shared/http';

describe('HTTP adapter handlers', () => {
  it('renders DFA from a POST body with invoice data', async () => {
    const calls: unknown[] = [];
    const efatura = {
      validateInvoice(invoice: Record<string, unknown>) {
        return { ...invoice, validated: true };
      },
      async renderDfa(input: unknown) {
        calls.push(input);

        return {
          contentType: 'application/pdf',
          filename: 'dfa.pdf',
          buffer: Buffer.from('pdf'),
        };
      },
    };

    const result = await handleRenderDfaFromBody(efatura as never, {
      iud: 'CV3260208100200300001230100000000112345678909',
      invoice: { type: 'FTE' },
      options: { currency: 'CVE' },
    });

    expect(result.status).toBe(200);
    expect(result.headers?.['content-type']).toBe('application/pdf');
    expect(calls).toEqual([
      {
        iud: 'CV3260208100200300001230100000000112345678909',
        invoice: { type: 'FTE', validated: true },
        currency: 'CVE',
      },
    ]);
  });
});
