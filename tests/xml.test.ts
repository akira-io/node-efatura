import { describe, expect, it } from 'vitest';
import { buildDfeXml, DFE_NAMESPACE } from '../src/application/xml/dfe-xml';
import { createEfatura } from '../src/create-efatura';
import { DocumentType } from '../src/domain/enums/document-type';
import { EmissionMode } from '../src/domain/enums/emission-mode';
import { baseInvoicePayload } from './helpers';

const config = {
  transmitterNif: '100200300',
  transmitterLed: '123',
  transmitterKey: 'k'.repeat(64),
  softwareCode: 'SW001',
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
          taxId: { countryCode: 'CV', value: '100200300' },
          name: 'Emitter & Co',
          contacts: {
            email: 'issuer@example.cv',
            telephone: '5551234',
          },
        },
      }),
    );
    const xml = buildDfeXml({ iud, invoice, config: efatura.config });

    expect(xml).toContain(`xmlns="${DFE_NAMESPACE}"`);
    expect(xml).toContain(`Id="${iud}"`);
    expect(xml).toContain('DocumentTypeCode="1"');
    expect(xml).toContain('<Invoice><LedCode>123</LedCode>');
    expect(xml).toContain('<Software><Code>SW001</Code><Name>Efatura Suite</Name>');
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
          taxId: { countryCode: 'CV', value: '100200300' },
          name: 'Emitter',
          contacts: {
            email: 'issuer@example.cv',
            telephone: '5551234',
          },
        },
        contingency: {
          ledCode: '123',
          issueDate: '2026-02-08',
          issueTime: '11:30:00',
          reasonTypeCode: '4',
        },
      }),
      {
        documentNumber: 7,
        randomCode: '1111111111',
        emissionMode: EmissionMode.Offline,
      },
    );

    expect(xml).toContain('DocumentTypeCode="3"');
    expect(xml).toContain('<SalesReceipt>');
    expect(xml).toContain('<Serie>SER-F</Serie>');
    expect(xml).toContain('<IssueMode>2</IssueMode>');
    expect(xml).toContain('<Contingency><LedCode>123</LedCode>');
    expect(xml).not.toContain('<Receiver>');
  });

  it('uses a dedicated default serie instead of the transmitter LED', () => {
    const efatura = createEfatura({ ...config, defaultSerie: 'SER-A' }, { clock: fixedClock });
    const xml = efatura.buildDfeXml(baseInvoicePayload({ serie: undefined }), {
      documentNumber: 1,
      randomCode: '1234567890',
    });

    expect(xml).toContain('<Serie>SER-A</Serie>');
    expect(xml).not.toContain('<Serie>123</Serie>');
  });

  it('requires serie when no dedicated default serie is configured', () => {
    const efatura = createEfatura(config, { clock: fixedClock });

    expect(() =>
      efatura.buildDfeXml(baseInvoicePayload({ serie: undefined }), {
        documentNumber: 1,
        randomCode: '1234567890',
      }),
    ).toThrow('serie is required.');
  });

  it('allows IssueTime to be omitted in Off emission mode', () => {
    const efatura = createEfatura(config, { clock: fixedClock });
    const xml = efatura.buildDfeXml(
      baseInvoicePayload({
        issueTime: undefined,
        contingency: {
          ledCode: '123',
          iuc: 'IUC-123',
          issueDate: '2026-02-08',
          reasonTypeCode: '0',
          reasonDescription: 'Offline sem hora.',
        },
      }),
      {
        documentNumber: 1,
        randomCode: '1234567890',
        emissionMode: EmissionMode.Off,
      },
    );

    expect(xml).toContain('<IssueMode>3</IssueMode>');
    expect(xml).not.toContain('<IssueTime>');
  });

  it('still requires IssueTime outside Off emission mode', () => {
    const efatura = createEfatura(config, { clock: fixedClock });

    expect(() =>
      efatura.buildDfeXml(baseInvoicePayload({ issueTime: undefined }), {
        documentNumber: 1,
        randomCode: '1234567890',
      }),
    ).toThrow('issueTime is required.');
  });

  it('requires emitter contacts for v11 XML', () => {
    const efatura = createEfatura(config, { clock: fixedClock });

    expect(() =>
      efatura.buildDfeXml(
        baseInvoicePayload({
          issueDate: '2026-02-08',
          emitter: {
            contacts: {
              email: null,
            },
          },
        }),
        {
          documentNumber: 1,
          randomCode: '1234567890',
        },
      ),
    ).toThrow('Emitter email is required.');
  });

  it('serializes custom ExtraFields as typed XML blocks', () => {
    const efatura = createEfatura(config, { clock: fixedClock });
    const xml = efatura.buildDfeXml(
      baseInvoicePayload({
        issueDate: '2026-02-08',
        issueTime: '11:30:00',
        extraFields: [
          {
            name: 'CustomAudit',
            attributes: { Source: 'POS' },
            children: [{ name: 'TerminalId', value: 'T-01' }],
          },
        ],
      }),
      {
        documentNumber: 1,
        randomCode: '1234567890',
      },
    );

    expect(xml).toContain(
      '<ExtraFields><CustomAudit Source="POS"><TerminalId>T-01</TerminalId></CustomAudit></ExtraFields>',
    );
  });
});
