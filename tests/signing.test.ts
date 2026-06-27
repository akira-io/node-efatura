import { createVerify } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { DOMParser } from '@xmldom/xmldom';
import { describe, expect, it } from 'vitest';
import { C14nCanonicalization } from 'xml-crypto';
import { createEfatura } from '../src/create-efatura';
import { DocumentType } from '../src/domain/enums/document-type';
import { EfaturaValidationError } from '../src/domain/errors';
import { temporaryCertificate } from './certificate-fixtures';
import { baseInvoicePayload } from './helpers';

describe('XAdES-BES signing', () => {
  it('requires certificate and private key material', async () => {
    const efatura = createEfatura(config());

    await expect(efatura.signDfeXml('<Dfe Id="x"></Dfe>')).rejects.toBeInstanceOf(
      EfaturaValidationError,
    );
  });

  it('signs DFE XML with XAdES-BES and keeps the document XSD-valid', async () => {
    const fixture = await temporaryCertificate();

    try {
      const efatura = createEfatura(config(), {
        clock: {
          now: () => new Date('2026-02-08T12:00:00Z'),
        },
      });
      const xml = efatura.buildDfeXml(
        baseInvoicePayload({
          issueDate: '2026-02-08',
          issueTime: '11:30:00',
        }),
        { documentNumber: 1, randomCode: '1234567890' },
      );
      const signed = await efatura.signDfeXml(xml, {
        certificate: fixture.certificate,
        privateKey: fixture.privateKey,
        signingTime: '2026-02-08T11:30:00.000Z',
      });

      expect(signed.algorithm).toBe('RSA-SHA256');
      expect(signed.profile).toBe('XAdES-BES');
      expect(signed.xml).toContain('<xades:SignedProperties');
      expect(verifySignatureValue(signed.xml, fixture.certificate)).toBe(true);
      await expect(
        efatura.validateDfeXml(signed.xml, DocumentType.ElectronicInvoice),
      ).resolves.toEqual({ valid: true, errors: [] });
    } finally {
      await rm(fixture.directory, { force: true, recursive: true });
    }
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

function verifySignatureValue(xml: string, certificate: string): boolean {
  const signedInfo = matchXml(xml, 'ds:SignedInfo');
  const signatureValue = matchText(xml, 'ds:SignatureValue').replace(/\s+/g, '');
  const node = new DOMParser().parseFromString(signedInfo, 'application/xml').documentElement;
  const canonicalSignedInfo = String(new C14nCanonicalization().process(node, {}));
  const verifier = createVerify('RSA-SHA256');

  verifier.update(canonicalSignedInfo);
  verifier.end();

  return verifier.verify(certificate, signatureValue, 'base64');
}

function matchText(xml: string, elementName: string): string {
  const match = new RegExp(`<${elementName}[^>]*>([\\s\\S]*?)</${elementName}>`).exec(xml);

  if (!match?.[1]) {
    throw new Error(`${elementName} not found.`);
  }

  return match[1];
}

function matchXml(xml: string, elementName: string): string {
  const match = new RegExp(`<${elementName}[^>]*>[\\s\\S]*?</${elementName}>`).exec(xml);

  if (!match?.[0]) {
    throw new Error(`${elementName} not found.`);
  }

  return match[0];
}
