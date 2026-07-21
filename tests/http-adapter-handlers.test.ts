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

  it('rejects a foreign legacy currency label before rendering', async () => {
    const calls: unknown[] = [];
    const efatura = adapterEfatura(calls);

    await expect(
      handleRenderDfaFromBody(efatura as never, {
        iud: 'CV3260208100200300001230100000000112345678909',
        options: { currency: 'EUR' },
      }),
    ).rejects.toMatchObject({ code: 'http.body_invalid' });
    expect(calls).toEqual([]);
  });

  it('rejects client-asserted conversion provenance before rendering', async () => {
    const calls: unknown[] = [];
    const efatura = adapterEfatura(calls);

    await expect(
      handleRenderDfaFromBody(efatura as never, {
        iud: 'CV3260208100200300001230100000000112345678909',
        options: {
          conversion: {
            sourceCurrency: 'EUR',
            targetCurrency: 'CVE',
            rate: 110.265,
            rateType: 'reference',
            effectiveAt: '2026-07-21T00:00:00Z',
            retrievedAt: '2026-07-21T12:30:00Z',
            provider: 'Banco de Cabo Verde',
            originalPayableAmount: 200,
            convertedPayableAmount: 22_053,
          },
        },
      }),
    ).rejects.toMatchObject({ code: 'http.body_invalid' });
    expect(calls).toEqual([]);
  });
});

function adapterEfatura(calls: unknown[]) {
  return {
    validateInvoice(invoice: Record<string, unknown>) {
      return invoice;
    },
    async renderDfa(input: unknown) {
      calls.push(input);

      return {
        contentType: 'application/pdf' as const,
        filename: 'dfa.pdf',
        buffer: Buffer.from('pdf'),
      };
    },
  };
}
