import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleRenderDfaFromBody } from '../src/presentation/shared/http';

const warningStateKey = Symbol.for('@akira-io/efatura/render-dfa-currency-deprecation');
const warningMessage =
  'RenderDfaOptions.currency is deprecated and will be removed in v1.0.0. Use prepareInvoiceToCve() and pass invoice with conversion metadata.';

describe('HTTP adapter handlers', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis, warningStateKey);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, warningStateKey);
  });

  it('renders DFA from a POST body with invoice data', async () => {
    const emitWarning = vi.spyOn(process, 'emitWarning').mockImplementation(() => undefined);
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
    expect(emitWarning).toHaveBeenCalledOnce();
    expect(calls).toEqual([
      {
        iud: 'CV3260208100200300001230100000000112345678909',
        invoice: { type: 'FTE', validated: true },
        currency: 'CVE',
      },
    ]);
  });

  it('rejects a foreign legacy currency label before rendering', async () => {
    let warningObserved = false;
    const emitWarning = vi.spyOn(process, 'emitWarning').mockImplementation(() => {
      warningObserved = true;
    });
    const calls: unknown[] = [];
    const efatura = adapterEfatura(calls);

    try {
      await handleRenderDfaFromBody(efatura as never, {
        iud: 'CV3260208100200300001230100000000112345678909',
        options: { currency: 'EUR' },
      });
      expect.unreachable('Expected the HTTP schema to reject a foreign legacy currency.');
    } catch (error) {
      expect(warningObserved).toBe(true);
      expect(error).toMatchObject({ code: 'http.body_invalid' });
    }
    await expect(
      handleRenderDfaFromBody(efatura as never, {
        iud: 'CV3260208100200300001230100000000112345678909',
        options: { currency: 'EUR' },
      }),
    ).rejects.toMatchObject({ code: 'http.body_invalid' });
    expect(emitWarning).toHaveBeenCalledOnce();
    expect(emitWarning).toHaveBeenCalledWith(warningMessage, {
      type: 'DeprecationWarning',
      code: 'EFATURA_RENDER_DFA_CURRENCY_DEPRECATED',
    });
    expect(calls).toEqual([]);
  });

  it('warns before invoice validation rejects a defined currency option', async () => {
    let warningObserved = false;
    vi.spyOn(process, 'emitWarning').mockImplementation(() => {
      warningObserved = true;
    });
    const validationFailure = new Error('Invalid invoice fixture.');
    const renderDfa = vi.fn();
    const efatura = {
      validateInvoice() {
        throw validationFailure;
      },
      renderDfa,
    };

    try {
      await handleRenderDfaFromBody(efatura as never, {
        iud: 'CV3260208100200300001230100000000112345678909',
        invoice: { type: 'invalid' },
        options: { currency: 'CVE' },
      });
      expect.unreachable('Expected invoice validation to reject.');
    } catch (error) {
      expect(warningObserved).toBe(true);
      expect(error).toBe(validationFailure);
    }
    expect(renderDfa).not.toHaveBeenCalled();
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
