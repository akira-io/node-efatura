import { rm } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createEfatura } from '../src/create-efatura';
import { OpensslCertificateValidator } from '../src/infrastructure';
import { temporaryCertificate } from './certificate-fixtures';

describe('certificate validation', () => {
  it('validates matching certificate private key and CA bundle', async () => {
    const fixture = await temporaryCertificate({ commonName: 'Efatura Certificate Test' });

    try {
      const result = await createEfatura(config()).validateCertificate({
        certificate: fixture.certificate,
        privateKey: fixture.privateKey,
        caCertificates: [fixture.certificate],
      });

      expect(result.valid).toBe(true);
      expect(result.subject).toContain('Efatura Certificate Test');
      expect(result.issues).toEqual([]);
    } finally {
      await rm(fixture.directory, { force: true, recursive: true });
    }
  });

  it('rejects private keys that do not match the certificate', async () => {
    const certificate = await temporaryCertificate({ serialNumber: '1001' });
    const otherCertificate = await temporaryCertificate({ serialNumber: '1002' });

    try {
      const result = await createEfatura(config()).validateCertificate({
        certificate: certificate.certificate,
        privateKey: otherCertificate.privateKey,
      });

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: 'certificate.private_key_mismatch' }),
      );
    } finally {
      await rm(certificate.directory, { force: true, recursive: true });
      await rm(otherCertificate.directory, { force: true, recursive: true });
    }
  });

  it('returns structured issues for invalid certificate material', async () => {
    const result = await new OpensslCertificateValidator().validate({ certificate: 'invalid' });

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'certificate.invalid' }));
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
