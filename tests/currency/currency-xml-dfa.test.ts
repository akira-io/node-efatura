import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type CurrencyConversionMetadata,
  createEfatura,
  type DfaRenderInput,
  EfaturaValidationError,
  type ExchangeRateRequest,
  FixedExchangeRateProvider,
} from '../../src';
import { dfaRenderInputFrom } from '../../src/application/dfa/dfa-render-input';
import { EmissionMode } from '../../src/domain/enums/emission-mode';
import { baseInvoicePayload } from '../helpers';

const iud = 'CV3260208100200300001230100000000112345678909';
const config = {
  transmitterNif: '100200300',
  transmitterLed: '123',
  softwareCode: 'SW001',
  softwareName: 'Efatura Suite',
  softwareVersion: '1.0.0',
  middlewareBaseUrl: 'https://middleware.example',
};
const warningStateKey = Symbol.for('@akira-io/efatura/render-dfa-currency-deprecation');

describe('currency conversion DFA mapping', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis, warningStateKey);
    vi.spyOn(process, 'emitWarning').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, warningStateKey);
  });

  it('builds synchronous XML with CVE payable and foreign alternative amounts', async () => {
    const effectiveAt = new Date('2026-07-21T11:30:00Z');
    const efatura = createEfatura(config, {
      clock: { now: () => new Date('2026-07-21T12:00:00Z') },
      exchangeRateProvider: new FixedExchangeRateProvider({
        sourceCurrency: 'EUR',
        targetCurrency: 'CVE',
        rate: 110.265,
        effectiveAt,
        provider: 'Test provider',
      }),
    });
    const prepared = await efatura.prepareInvoiceToCve(invoicePayableAt200(), {
      sourceCurrency: 'EUR',
    });

    const xml = efatura.buildDfeXml(prepared.invoice, {
      iud,
      emissionMode: EmissionMode.Online,
    });

    expect(xml).toBeTypeOf('string');
    expect(xml).toContain('<PayableAmount>22053</PayableAmount>');
    expect(xml).toContain(
      '<PayableAlternativeAmount CurrencyCode="EUR" ExchangeRate="110.265">200</PayableAlternativeAmount>',
    );
  });

  it('gives custom renderers the complete prepared conversion evidence and CVE totals', async () => {
    const renderedInputs: DfaRenderInput[] = [];
    const render = vi.fn(async (input: DfaRenderInput) => {
      renderedInputs.push(input);

      return {
        contentType: 'application/pdf' as const,
        filename: 'dfa.pdf',
        buffer: Buffer.from('pdf'),
      };
    });
    const effectiveAt = new Date('2026-07-21T00:00:00Z');
    const retrievedAt = new Date('2026-07-21T12:30:00Z');
    const getQuote = vi.fn(async (request: ExchangeRateRequest) => ({
      ...request,
      rate: 110.265,
      rateType: 'reference' as const,
      effectiveAt,
      retrievedAt,
      provider: 'Banco de Cabo Verde',
      sourceUrl: 'https://www.bcv.cv/taxas/2026-07-21',
    }));
    const efatura = createEfatura(config, {
      dfaRenderer: { render },
      exchangeRateProvider: { getQuote },
    });
    const prepared = await efatura.prepareInvoiceToCve(invoicePayableAt200(), {
      sourceCurrency: 'EUR',
      effectiveAt,
      rateType: 'reference',
    });

    await efatura.renderDfa({
      iud,
      invoice: prepared.invoice,
      conversion: prepared.conversion,
      currency: 'EUR',
    });

    expect(render).toHaveBeenCalledOnce();
    expect(getQuote).toHaveBeenCalledOnce();
    expect(renderedInputs[0]).toMatchObject({
      currency: 'CVE',
      total: 22_053,
      conversion: prepared.conversion,
    });
    expect(renderedInputs[0]?.conversion).toEqual<CurrencyConversionMetadata>({
      sourceCurrency: 'EUR',
      targetCurrency: 'CVE',
      rate: 110.265,
      rateType: 'reference',
      effectiveAt,
      retrievedAt,
      provider: 'Banco de Cabo Verde',
      sourceUrl: 'https://www.bcv.cv/taxas/2026-07-21',
      originalPayableAmount: 200,
      convertedPayableAmount: 22_053,
    });
  });

  it('rejects a legacy foreign label when no validated invoice establishes CVE values', () => {
    expect(() =>
      dfaRenderInputFrom(
        {
          iud,
          currency: 'EUR',
        },
        'https://pe.efatura.cv/dfe/view/example',
      ),
    ).toThrowError(
      expect.objectContaining({
        field: 'currency',
        code: 'dfa.currency_invalid',
      }),
    );
    expect(() =>
      dfaRenderInputFrom(
        {
          iud,
          currency: 'EUR',
        },
        'https://pe.efatura.cv/dfe/view/example',
      ),
    ).toThrowError(EfaturaValidationError);
  });

  it('rejects direct DFA conversion metadata without an invoice', async () => {
    const prepared = await preparedForDfa();

    expect(() =>
      dfaRenderInputFrom(
        { iud, conversion: prepared.conversion },
        'https://pe.efatura.cv/dfe/view/example',
      ),
    ).toThrowError(
      expect.objectContaining({ field: 'conversion', code: 'dfa.conversion_invalid' }),
    );
  });

  it('rejects direct DFA conversion metadata with a non-CVE target', async () => {
    const prepared = await preparedForDfa();

    expect(() =>
      dfaRenderInputFrom(
        {
          iud,
          invoice: prepared.invoice,
          conversion: { ...prepared.conversion, targetCurrency: 'USD' },
        },
        'https://pe.efatura.cv/dfe/view/example',
      ),
    ).toThrowError(
      expect.objectContaining({ field: 'conversion', code: 'dfa.conversion_invalid' }),
    );
  });

  it('rejects direct DFA conversion metadata that disagrees with payable values', async () => {
    const prepared = await preparedForDfa();

    expect(() =>
      dfaRenderInputFrom(
        {
          iud,
          invoice: prepared.invoice,
          conversion: { ...prepared.conversion, convertedPayableAmount: 1 },
        },
        'https://pe.efatura.cv/dfe/view/example',
      ),
    ).toThrowError(
      expect.objectContaining({ field: 'conversion', code: 'dfa.conversion_invalid' }),
    );
    expect(() =>
      dfaRenderInputFrom(
        {
          iud,
          invoice: prepared.invoice,
          conversion: { ...prepared.conversion, originalPayableAmount: 1 },
        },
        'https://pe.efatura.cv/dfe/view/example',
      ),
    ).toThrowError(
      expect.objectContaining({ field: 'conversion', code: 'dfa.conversion_invalid' }),
    );
  });

  it('rejects direct DFA URL credentials without retaining them in the error', async () => {
    const credentialSentinel = 'DFA_SECRET_PASSWORD';
    const prepared = await preparedForDfa();

    try {
      dfaRenderInputFrom(
        {
          iud,
          invoice: prepared.invoice,
          conversion: {
            ...prepared.conversion,
            sourceUrl: `https://user:${credentialSentinel}@rates.example/evidence`,
          },
        },
        'https://pe.efatura.cv/dfe/view/example',
      );
      throw new Error('Expected DFA conversion validation to fail.');
    } catch (error) {
      expect(error).toMatchObject({ field: 'conversion', code: 'dfa.conversion_invalid' });
      expect(String(error)).not.toContain(credentialSentinel);
      expect(String((error as Error & { cause?: unknown }).cause)).not.toContain(
        credentialSentinel,
      );
    }
  });
});

async function preparedForDfa() {
  const effectiveAt = new Date('2026-07-21T11:30:00Z');
  const efatura = createEfatura(config, {
    exchangeRateProvider: new FixedExchangeRateProvider({
      sourceCurrency: 'EUR',
      targetCurrency: 'CVE',
      rate: 110.265,
      effectiveAt,
      provider: 'Test provider',
    }),
  });

  return efatura.prepareInvoiceToCve(invoicePayableAt200(), {
    sourceCurrency: 'EUR',
    effectiveAt,
  });
}

function invoicePayableAt200(): Record<string, unknown> {
  return baseInvoicePayload({
    issueDate: '2026-07-21',
    lines: [
      {
        lineTypeCode: 'N',
        quantity: { value: 1, unitCode: 'EA' },
        price: 173.91,
        priceExtension: 173.91,
        netTotal: 173.91,
        taxes: [{ taxTypeCode: 'IVA', taxPercentage: 15, taxTotal: 26.09 }],
        item: { description: 'Item', emitterIdentification: 'ITEM1' },
      },
    ],
    totals: {
      priceExtensionTotalAmount: 173.91,
      chargeTotalAmount: 0,
      discountTotalAmount: 0,
      netTotalAmount: 173.91,
      taxTotalAmount: 26.09,
      payableAmount: 200,
    },
  });
}
