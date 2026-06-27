import { describe, expect, it } from 'vitest';
import { createEfatura } from '../src/create-efatura';
import { DocumentType } from '../src/domain/enums/document-type';
import { EventType } from '../src/domain/enums/event-type';
import { parseEventId, validateEventId } from '../src/domain/iud/event-id';

const config = {
  transmitterNif: '100200300',
  transmitterLed: '123',
  transmitterKey: 'k'.repeat(64),
  softwareCode: 'SW001',
  softwareName: 'Efatura Suite',
  softwareVersion: '1.0.0',
  middlewareBaseUrl: 'https://localhost:3443',
};

describe('official Event XML', () => {
  it('builds and parses the official 24-character Event Id', () => {
    const efatura = createEfatura(config);
    const eventId = efatura.buildEventId({ issueDateTime: '2026-02-08T11:30:00' });

    expect(eventId).toBe('CV3260208113000100200300');
    expect(validateEventId(eventId)).toBe(true);
    expect(parseEventId(eventId)).toEqual({
      countryCode: 'CV',
      repositoryCode: '3',
      issueDate: '2026-02-08',
      issueTime: '11:30:00',
      transmitterNif: '100200300',
    });
  });

  it('builds an FDC cancellation event for one or more IUDs', async () => {
    const efatura = createEfatura(config);
    const iud = efatura.buildIud({
      issueDate: '2026-02-08',
      documentType: DocumentType.ElectronicInvoice,
      documentNumber: 1,
      randomCode: '1234567890',
    });
    const xml = efatura.buildEventXml({
      type: EventType.FiscalDocumentCancellation,
      issueDateTime: '2026-02-08T11:30:00',
      issueReasonDescription: 'Documento emitido com dados incorretos.',
      iuds: [iud],
    });

    expect(xml).toContain('EventTypeCode="FDC"');
    expect(xml).toContain(`<IUD>${iud}</IUD>`);
    expect(xml).toContain('<EmitterTaxId CountryCode="CV">100200300</EmitterTaxId>');
    await expect(efatura.validateEventXml(xml)).resolves.toEqual({ valid: true, errors: [] });
  });

  it('builds a UDN event for an unused document number range', async () => {
    const efatura = createEfatura(config);
    const xml = efatura.buildEventXml({
      type: EventType.UnusedDocumentNumber,
      issueDateTime: '2026-02-08T11:30:00',
      issueReasonDescription: 'Sequencia nao utilizada.',
      range: {
        year: '2026',
        ledCode: '123',
        serie: '123',
        documentTypeCode: 1,
        documentNumberStart: 10,
        documentNumberEnd: 12,
      },
    });

    expect(xml).toContain('EventTypeCode="UDN"');
    expect(xml).toContain('<DocumentNumberStart>10</DocumentNumberStart>');
    expect(xml).toContain('<DocumentNumberEnd>12</DocumentNumberEnd>');
    await expect(efatura.validateEventXml(xml)).resolves.toEqual({ valid: true, errors: [] });
  });

  it('rejects event targets that do not match the event type', () => {
    const efatura = createEfatura(config);

    expect(() =>
      efatura.buildEventXml({
        type: EventType.UnusedDocumentNumber,
        issueDateTime: '2026-02-08T11:30:00',
        issueReasonDescription: 'Sem intervalo.',
        iuds: [],
      }),
    ).toThrow('Event is invalid.');
  });
});
