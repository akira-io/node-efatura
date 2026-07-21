import { describe, expect, it } from 'vitest';
import { linesXml } from '../src/application/xml/dfe-lines-xml';
import { totalsXml } from '../src/application/xml/dfe-totals-xml';
import { escapeXml } from '../src/application/xml/xml-core';
import { TaxTypeCode } from '../src/domain/enums/tax-type-code';
import type { LineItemData } from '../src/domain/value-objects/line-item-data';
import type { TotalsData } from '../src/domain/value-objects/totals-data';

describe('XML number formatting', () => {
  it('serializes decimal values with at most 5 fractional digits', () => {
    const line: LineItemData = {
      lineTypeCode: 'N',
      id: null,
      lineReferenceId: null,
      orderLineReference: null,
      quantity: { value: 1.234567, unitCode: 'EA', isStandardUnitCode: null },
      price: 300.1 * 3,
      priceExtension: 1.234567,
      discount: null,
      netTotal: 1.234567,
      taxes: [
        {
          taxTypeCode: TaxTypeCode.IVA,
          stampTaxCode: null,
          taxPercentage: 15.123456,
          taxAmount: null,
          taxExemptionReasonCode: null,
          taxTotal: 0.1 + 0.2,
        },
      ],
      item: {
        description: 'Item',
        packQuantity: null,
        name: null,
        brandName: null,
        modelName: null,
        emitterIdentification: 'ITEM1',
        standardIdentification: null,
        hazardousRiskIndicator: null,
        extraProperties: [],
      },
    };

    const xml = linesXml([line]);

    expect(xml).toContain('<Quantity UnitCode="EA">1.23457</Quantity>');
    expect(xml).toContain('<Price>900.3</Price>');
    expect(xml).toContain('<PriceExtension>1.23457</PriceExtension>');
    expect(xml).toContain('<TaxPercentage>15.12346</TaxPercentage>');
    expect(xml).toContain('<TaxTotal>0.3</TaxTotal>');
    expect(xml).not.toContain('300.299999999999');
  });

  it('serializes payable alternative amount decimals in text and attributes', () => {
    const totals: TotalsData = {
      priceExtensionTotalAmount: 100,
      chargeTotalAmount: null,
      discountTotalAmount: null,
      netTotalAmount: 100,
      discount: null,
      taxTotalAmount: 15,
      withholdingTaxTotalAmount: null,
      payableRoundingAmount: null,
      payableAmount: 115,
      payableAlternativeAmounts: [
        {
          value: 123.4500001,
          currencyCode: 'EUR',
          exchangeRate: 1.234567,
        },
      ],
    };

    expect(totalsXml(totals)).toContain(
      '<PayableAlternativeAmount CurrencyCode="EUR" ExchangeRate="1.23457">123.45</PayableAlternativeAmount>',
    );
  });

  it.each([
    [110.265004, '110.265'],
    [110.265006, '110.26501'],
  ])('rounds payable alternative exchange rate %d to %s at five decimal places', (exchangeRate, expected) => {
    const totals: TotalsData = {
      priceExtensionTotalAmount: 100,
      chargeTotalAmount: null,
      discountTotalAmount: null,
      netTotalAmount: 100,
      discount: null,
      taxTotalAmount: 15,
      withholdingTaxTotalAmount: null,
      payableRoundingAmount: null,
      payableAmount: 115,
      payableAlternativeAmounts: [{ value: 100, currencyCode: 'EUR', exchangeRate }],
    };

    expect(totalsXml(totals)).toContain(`ExchangeRate="${expected}"`);
  });

  it('serializes large numbers without exponential notation', () => {
    expect(escapeXml(1e21)).toBe('1000000000000000000000');
  });

  it('does not pre-round numbers beyond safe integer scaling', () => {
    expect(escapeXml(100035982945.70169)).toBe('100035982945.70169');
  });
});
