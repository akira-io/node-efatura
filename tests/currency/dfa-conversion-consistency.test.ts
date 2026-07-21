import { describe, expect, it } from 'vitest';
import { createEfatura, FixedExchangeRateProvider, type RenderDfaOptions } from '../../src';
import { dfaRenderInputFrom } from '../../src/application/dfa/dfa-render-input';
import { baseInvoicePayload } from '../helpers';

const iud = 'CV3260208100200300001230100000000112345678909';
const qrCodeUrl = 'https://pe.efatura.cv/dfe/view/example';
const effectiveAt = new Date('2026-07-21T11:30:00Z');
const config = {
  transmitterNif: '100200300',
  transmitterLed: '123',
  softwareCode: 'SW001',
  softwareName: 'Efatura Suite',
  softwareVersion: '1.0.0',
  middlewareBaseUrl: 'https://middleware.example',
};

describe('direct DFA conversion payable consistency', () => {
  it.each([
    ['positive amount', 2.2, 110.265, 242.58],
    ['exact decimal product', 12.34, 2, 24.68],
    ['half-up rounding boundary', 0.01, 2.5, 0.03],
    ['zero amount', 0, 110.265, 0],
  ])('accepts %s', async (_scenario, originalAmount, rate, convertedAmount) => {
    const options = await directDfaOptions(originalAmount, rate, convertedAmount);

    expect(() => dfaRenderInputFrom(options, qrCodeUrl)).not.toThrow();
  });

  it('preserves rejection when invoice totals are absent', async () => {
    const options = await directDfaOptions(200, 110.265, 22_053);

    expect(() =>
      dfaRenderInputFrom(
        {
          ...options,
          invoice: options.invoice ? { ...options.invoice, totals: null } : undefined,
        },
        qrCodeUrl,
      ),
    ).toThrowError(
      expect.objectContaining({ field: 'conversion', code: 'dfa.conversion_invalid' }),
    );
  });

  it('rejects a tampered rate that agrees with the alternative amount only', async () => {
    const options = await directDfaOptions(200, 110, 22_053);

    expect(() => dfaRenderInputFrom(options, qrCodeUrl)).toThrowError(
      expect.objectContaining({
        field: 'conversion',
        code: 'dfa.conversion_invalid',
        message: 'DFA conversion metadata must match the invoice payable values.',
      }),
    );
  });
});

async function directDfaOptions(
  originalPayableAmount: number,
  rate: number,
  convertedPayableAmount: number,
): Promise<RenderDfaOptions> {
  const prepared = await preparedForDfa();
  const totals = prepared.invoice.totals;

  if (totals === null) {
    throw new Error('Expected prepared invoice totals.');
  }

  return {
    iud,
    invoice: {
      ...prepared.invoice,
      totals: {
        ...totals,
        payableAmount: convertedPayableAmount,
        payableAlternativeAmounts: [
          {
            value: originalPayableAmount,
            currencyCode: 'EUR',
            exchangeRate: rate,
          },
        ],
      },
    },
    conversion: {
      ...prepared.conversion,
      rate,
      originalPayableAmount,
      convertedPayableAmount,
    },
  };
}

async function preparedForDfa() {
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
