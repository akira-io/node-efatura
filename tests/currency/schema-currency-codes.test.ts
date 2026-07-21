import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { normalizeCurrencyCode } from '../../src/domain/currency/exchange-rate-quote';
import { SCHEMA_CURRENCY_CODES } from '../../src/domain/currency/schema-currency-codes';

const currencySchemaUrl = new URL(
  '../../resources/xsd/efatura/2024-05-27/common/ISO_ISO3AlphaCurrencyCode_2012-08-31.xsd',
  import.meta.url,
);

describe('schema currency codes', () => {
  it('matches the complete checked-in runtime set to the active XSD enumeration', async () => {
    const schemaSource = await readFile(currencySchemaUrl, 'utf8');
    const schemaEnumerationValues = Array.from(
      schemaSource.matchAll(/xsd:enumeration value="(?<currencyCode>[^"]+)"/g),
      (match) => match.groups?.currencyCode ?? '',
    );
    const canonicalCurrencyCodes = schemaEnumerationValues.filter((currencyCode) =>
      /^[A-Z]{3}$/.test(currencyCode),
    );
    const noncanonicalCurrencyCodes = schemaEnumerationValues.filter(
      (currencyCode) => !/^[A-Z]{3}$/.test(currencyCode),
    );

    expect(schemaEnumerationValues).toHaveLength(179);
    expect(noncanonicalCurrencyCodes).toEqual(['IdR']);
    expect(SCHEMA_CURRENCY_CODES).toEqual(canonicalCurrencyCodes);

    for (const currencyCode of canonicalCurrencyCodes) {
      expect(normalizeCurrencyCode(currencyCode)).toBe(currencyCode);
    }
  });
});
