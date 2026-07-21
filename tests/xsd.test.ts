import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { FixedExchangeRateProvider } from '../src';
import { createEfatura } from '../src/create-efatura';
import { DocumentType } from '../src/domain/enums/document-type';
import { resolveDefaultSchemaPath, XmllintXsdValidator } from '../src/infrastructure';
import { baseInvoicePayload, generatedDocumentPayloads } from './helpers';

const xsdDirectory = join(process.cwd(), 'resources/xsd/efatura/2024-05-27');

const officialExamples = [
  ['1 Invoice - EnvelopedSignature.xml', DocumentType.ElectronicInvoice],
  ['2 InvoiceReceipt.xml', DocumentType.ElectronicInvoiceReceipt],
  ['3 SalesReceipt.xml', DocumentType.ElectronicSalesTicket],
  ['4 Receipt.xml', DocumentType.ElectronicReceipt],
  ['6 DebitNote.xml', DocumentType.ElectronicDebitNote],
  ['7 Transport.xml', DocumentType.ElectronicTransportDocument],
  ['9 RegistrationNote.xml', DocumentType.ElectronicEntryNote],
] as const;

describe('official XSD validation', () => {
  it('resolves the bundled official enveloped-signature schema', () => {
    expect(resolveDefaultSchemaPath()).toContain('EnvelopedSignature.xsd');
  });

  it.each(officialExamples)('validates official XML example %s', async (fileName, documentType) => {
    const validator = new XmllintXsdValidator();
    const xml = await readFile(join(xsdDirectory, fileName), 'utf8');
    const result = await validator.validate(xml, { documentType, schemaVersion: '1.0' });

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('validates generated DFE XML against the official schema', async () => {
    const efatura = createEfatura(
      {
        transmitterNif: '100200300',
        transmitterLed: '123',
        softwareCode: 'SW001',
        softwareName: 'Efatura Suite',
        softwareVersion: '1.0.0',
        middlewareBaseUrl: 'https://localhost:3443',
      },
      {
        clock: {
          now: () => new Date('2026-02-08T12:00:00Z'),
        },
      },
    );
    const xml = efatura.buildDfeXml(
      baseInvoicePayload({
        issueDate: '2026-02-08',
        issueTime: '11:30:00',
      }),
      {
        documentNumber: 1,
        randomCode: '1234567890',
      },
    );
    const result = await efatura.validateDfeXml(xml, DocumentType.ElectronicInvoice);

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it.each([
    'XAU',
    'XTS',
    'XXX',
  ])('validates a prepared %s alternative amount against the official schema', async (sourceCurrency) => {
    const effectiveAt = new Date('2026-07-21T11:30:00Z');
    const efatura = createEfatura(config(), {
      clock: { now: () => new Date('2026-07-21T12:00:00Z') },
      exchangeRateProvider: new FixedExchangeRateProvider({
        sourceCurrency,
        targetCurrency: 'CVE',
        rate: 1,
        effectiveAt,
        provider: 'Test provider',
      }),
    });
    const prepared = await efatura.prepareInvoiceToCve(
      baseInvoicePayload({
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
      }),
      { sourceCurrency },
    );
    const xml = efatura.buildDfeXml(prepared.invoice, {
      documentNumber: 1,
      randomCode: '1234567890',
    });
    const validator = new XmllintXsdValidator();

    const result = await validator.validate(xml, {
      documentType: DocumentType.ElectronicInvoice,
      schemaVersion: '1.0',
    });

    expect(xml).toContain(`CurrencyCode="${sourceCurrency}"`);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('rejects canonical IDR before provider access', async () => {
    const getQuote = vi.fn(async () => {
      throw new Error('Provider must not be called.');
    });
    const efatura = createEfatura(config(), { exchangeRateProvider: { getQuote } });

    await expect(
      efatura.prepareInvoiceToCve(baseInvoicePayload(), { sourceCurrency: 'IDR' }),
    ).rejects.toMatchObject({ code: 'exchange_rate.currency_unsupported' });
    expect(getQuote).not.toHaveBeenCalled();
  });

  it('records the active XSD mixed-case IDR lexical anomaly', async () => {
    const efatura = createEfatura(config(), {
      clock: { now: () => new Date('2026-02-08T12:00:00Z') },
    });
    const generatedXml = efatura.buildDfeXml(
      baseInvoicePayload({
        totals: {
          payableAlternativeAmounts: [{ value: 1150, currencyCode: 'IdR', exchangeRate: 1 }],
        },
      }),
      { documentNumber: 1, randomCode: '1234567890' },
    );
    const anomalousSchemaXml = generatedXml.replace('CurrencyCode="IDR"', 'CurrencyCode="IdR"');
    const validator = new XmllintXsdValidator();
    const context = {
      documentType: DocumentType.ElectronicInvoice,
      schemaVersion: '1.0',
    } as const;

    expect(generatedXml).toContain('CurrencyCode="IDR"');
    expect(generatedXml).not.toContain('CurrencyCode="IdR"');
    await expect(validator.validate(generatedXml, context)).resolves.toMatchObject({
      valid: false,
    });
    await expect(validator.validate(anomalousSchemaXml, context)).resolves.toEqual({
      valid: true,
      errors: [],
    });
  });

  it.each(
    generatedDocumentPayloads(),
  )('validates generated %s XML against the official schema', async (documentType, payload, documentNumber) => {
    const efatura = createEfatura(config(), {
      clock: {
        now: () => new Date('2026-02-08T12:00:00Z'),
      },
    });
    const xml = efatura.buildDfeXml(payload, {
      documentNumber,
      randomCode: '1234567890',
    });
    const result = await efatura.validateDfeXml(xml, documentType);

    expect(result).toEqual({ valid: true, errors: [] });
  });
});

function config() {
  return {
    transmitterNif: '100200300',
    transmitterLed: '123',
    softwareCode: 'SW001',
    softwareName: 'Efatura Suite',
    softwareVersion: '1.0.0',
    middlewareBaseUrl: 'https://localhost:3443',
  };
}
