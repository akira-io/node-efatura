import { rm } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { createEfatura } from '../src/create-efatura';
import { OpensslCertificateValidator } from '../src/infrastructure';
import {
  isOpensslAvailable,
  type TemporaryCertificate,
  type TemporaryCertificateOptions,
  temporaryCertificate,
} from './certificate-fixtures';

const opensslAvailable = await isOpensslAvailable();

describe.skipIf(!opensslAvailable)('certificate validation', () => {
  const directories: string[] = [];

  async function certificate(options?: TemporaryCertificateOptions): Promise<TemporaryCertificate> {
    const fixture = await temporaryCertificate(options);

    directories.push(fixture.directory);

    return fixture;
  }

  afterEach(async () => {
    await Promise.all(
      directories.map((directory) => rm(directory, { force: true, recursive: true })),
    );
    directories.length = 0;
  });

  it('validates matching certificate private key and CA bundle', async () => {
    const fixture = await certificate({ commonName: 'Efatura Certificate Test' });

    const result = await createEfatura(config()).validateCertificate({
      certificate: fixture.certificate,
      privateKey: fixture.privateKey,
      caCertificates: [fixture.certificate],
    });

    expect(result.valid).toBe(true);
    expect(result.subject).toContain('Efatura Certificate Test');
    expect(result.issues).toEqual([]);
  });

  it('rejects private keys that do not match the certificate', async () => {
    const fixture = await certificate({ serialNumber: '1001' });
    const otherFixture = await certificate({ serialNumber: '1002' });

    const result = await createEfatura(config()).validateCertificate({
      certificate: fixture.certificate,
      privateKey: otherFixture.privateKey,
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'certificate.private_key_mismatch' }),
    );
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
