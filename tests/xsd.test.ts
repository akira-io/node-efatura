import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
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

  it('validates a prepared CVE invoice with its foreign alternative amount against the official schema', async () => {
    const effectiveAt = new Date('2026-07-21T11:30:00Z');
    const efatura = createEfatura(config(), {
      clock: { now: () => new Date('2026-07-21T12:00:00Z') },
      exchangeRateProvider: new FixedExchangeRateProvider({
        sourceCurrency: 'EUR',
        targetCurrency: 'CVE',
        rate: 110.265,
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
      { sourceCurrency: 'EUR' },
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

    expect(result).toEqual({ valid: true, errors: [] });
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
