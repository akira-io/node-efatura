import { describe, expect, it } from 'vitest';
import { createEfatura } from '../../src';
import { baseInvoicePayload } from '../helpers';

const config = {
  transmitterNif: '100200300',
  transmitterLed: '123',
  softwareCode: 'SW001',
  softwareName: 'Efatura Suite',
  softwareVersion: '1.0.0',
  middlewareBaseUrl: 'https://middleware.example',
};

describe('payable alternative currency validation', () => {
  it.each([
    'IDR',
    'IdR',
    'ZZZ',
  ])('rejects unsupported low-level currency code %s', (currencyCode) => {
    const efatura = createEfatura(config);

    expect(() =>
      efatura.validateInvoice(invoiceWithAlternativeCurrency(currencyCode)),
    ).toThrowError(
      expect.objectContaining({ field: 'totals.payableAlternativeAmounts.0.currencyCode' }),
    );
  });

  it.each(['XAU', 'XTS', 'XXX'])('accepts canonical special currency code %s', (currencyCode) => {
    const efatura = createEfatura(config);
    const invoice = efatura.validateInvoice(invoiceWithAlternativeCurrency(currencyCode));

    expect(invoice.totals?.payableAlternativeAmounts[0]?.currencyCode).toBe(currencyCode);
  });
});

function invoiceWithAlternativeCurrency(currencyCode: string): Record<string, unknown> {
  return baseInvoicePayload({
    totals: {
      priceExtensionTotalAmount: 1000,
      chargeTotalAmount: 0,
      discountTotalAmount: 0,
      netTotalAmount: 1000,
      taxTotalAmount: 150,
      payableAmount: 1150,
      payableAlternativeAmounts: [{ value: 10, currencyCode, exchangeRate: 115 }],
    },
  });
}
