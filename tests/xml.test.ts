import { describe, expect, it } from 'vitest';
import { buildDfeXml, DFE_NAMESPACE } from '../src/application/xml/dfe-xml';
import { createEfatura } from '../src/create-efatura';
import { DocumentType } from '../src/domain/enums/document-type';
import { baseInvoicePayload } from './helpers';

const config = {
  transmitterNif: '100200300',
  transmitterLed: '123',
  transmitterKey: 'k'.repeat(64),
  softwareCode: 'SW-001',
  softwareName: 'Efatura Suite',
  softwareVersion: '1.0.0',
  middlewareBaseUrl: 'https://localhost:3443',
};

const fixedClock = {
  now: () => new Date('2026-02-08T12:00:00Z'),
};

describe('DFE XML', () => {
  it('builds compact DFE XML with v11 root attributes and document element', () => {
    const efatura = createEfatura(config);
    const iud = efatura.buildIud({
      issueDate: '2026-02-08',
      documentType: DocumentType.ElectronicInvoice,
      documentNumber: 1,
      randomCode: '1234567890',
    });
    const invoice = efatura.validateInvoice(
      baseInvoicePayload({
        emitter: {
          nif: '100200300',
          name: 'Emitter & Co',
          email: 'issuer@example.cv',
          phone: '5551234',
        },
      }),
    );
    const xml = buildDfeXml({ iud, invoice, config: efatura.config });

    expect(xml).toContain(`xmlns="${DFE_NAMESPACE}"`);
    expect(xml).toContain(`Id="${iud}"`);
    expect(xml).toContain('DocumentTypeCode="1"');
    expect(xml).toContain('<Invoice><Identification>');
    expect(xml).toContain('<Software><Code>SW-001</Code><Name>Efatura Suite</Name>');
    expect(xml).toContain('<Name>Emitter &amp; Co</Name>');
    expect(xml).not.toContain('\n');
  });

  it('builds XML through the facade when given a document number', () => {
    const efatura = createEfatura(config, { clock: fixedClock });
    const xml = efatura.buildDfeXml(
      baseInvoicePayload({
        issueDate: '2026-02-08',
        issueTime: '11:30:00',
        type: DocumentType.ElectronicSalesTicket,
        receiver: null,
        emitter: {
          nif: '100200300',
          name: 'Emitter',
          email: 'issuer@example.cv',
          phone: '5551234',
        },
        contingency: {
          reasonTypeCode: '4',
        },
      }),
      {
        documentNumber: 7,
        randomCode: '1111111111',
        emissionMode: 'Offline',
      },
    );

    expect(xml).toContain('DocumentTypeCode="3"');
    expect(xml).toContain('<SalesReceipt>');
    expect(xml).toContain('<IssueMode>OFFLINE</IssueMode>');
    expect(xml).toContain('<Contingency><LedCode>123</LedCode>');
    expect(xml).not.toContain('<Receiver>');
  });

  it('requires emitter contacts for v11 XML', () => {
    const efatura = createEfatura(config, { clock: fixedClock });

    expect(() =>
      efatura.buildDfeXml(baseInvoicePayload({ issueDate: '2026-02-08' }), {
        documentNumber: 1,
        randomCode: '1234567890',
      }),
    ).toThrow('Emitter email is required for e-Fatura v11.0 XML.');
  });
});
