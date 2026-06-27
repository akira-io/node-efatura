import { execFile } from 'node:child_process';
import { createPrivateKey, createPublicKey, X509Certificate } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type {
  CertificateValidationInput,
  CertificateValidationIssue,
  CertificateValidationResult,
  CertificateValidator,
} from '../../core/contracts';

const execFileAsync = promisify(execFile);

export class OpensslCertificateValidator implements CertificateValidator {
  async validate(input: CertificateValidationInput): Promise<CertificateValidationResult> {
    const issues: CertificateValidationIssue[] = [];
    const certificate = certificateFrom(input.certificate, issues);

    if (!certificate) {
      return { valid: false, issues };
    }

    issues.push(...validityIssues(certificate, input.at));

    if (input.privateKey) {
      issues.push(...privateKeyIssues(certificate, input.privateKey));
    }

    if (input.caCertificates && input.caCertificates.length > 0) {
      issues.push(...(await verifyCertificateChain(input.certificate, input.caCertificates)));
    }

    return {
      valid: issues.length === 0,
      subject: certificate.subject,
      issuer: certificate.issuer,
      serialNumber: certificate.serialNumber,
      fingerprint256: certificate.fingerprint256,
      validFrom: new Date(certificate.validFrom).toISOString(),
      validTo: new Date(certificate.validTo).toISOString(),
      issues,
    };
  }
}

function certificateFrom(
  value: string | Buffer,
  issues: CertificateValidationIssue[],
): X509Certificate | null {
  try {
    return new X509Certificate(value);
  } catch (error) {
    issues.push({
      code: 'certificate.invalid',
      message: 'Certificate material is not a valid X.509 certificate.',
      raw: errorMessage(error),
    });

    return null;
  }
}

function validityIssues(
  certificate: X509Certificate,
  value: Date | string | undefined,
): CertificateValidationIssue[] {
  const at = value === undefined ? new Date() : new Date(value);

  if (Number.isNaN(at.getTime())) {
    return [
      {
        code: 'certificate.validation_time_invalid',
        message: 'Certificate validation time is invalid.',
      },
    ];
  }

  const validFrom = new Date(certificate.validFrom);
  const validTo = new Date(certificate.validTo);

  if (at < validFrom) {
    return [
      {
        code: 'certificate.not_yet_valid',
        message: 'Certificate is not valid yet at the validation time.',
      },
    ];
  }

  if (at > validTo) {
    return [
      {
        code: 'certificate.expired',
        message: 'Certificate is expired at the validation time.',
      },
    ];
  }

  return [];
}

function privateKeyIssues(
  certificate: X509Certificate,
  privateKey: string | Buffer,
): CertificateValidationIssue[] {
  try {
    const publicKeyFromCertificate = certificate.publicKey
      .export({ format: 'pem', type: 'spki' })
      .toString();
    const publicKeyFromPrivateKey = createPublicKey(createPrivateKey(privateKey))
      .export({ format: 'pem', type: 'spki' })
      .toString();

    return publicKeyFromCertificate === publicKeyFromPrivateKey
      ? []
      : [
          {
            code: 'certificate.private_key_mismatch',
            message: 'Private key does not match the certificate public key.',
          },
        ];
  } catch (error) {
    return [
      {
        code: 'private_key.invalid',
        message: 'Private key material is invalid.',
        raw: errorMessage(error),
      },
    ];
  }
}

async function verifyCertificateChain(
  certificate: string | Buffer,
  caCertificates: Array<string | Buffer>,
): Promise<CertificateValidationIssue[]> {
  const directory = await mkdtemp(join(tmpdir(), 'efatura-certificate-'));
  const certificatePath = join(directory, 'certificate.pem');
  const caPath = join(directory, 'ca.pem');

  try {
    await writeFile(certificatePath, certificate);
    await writeFile(caPath, caCertificates.map((ca) => ca.toString()).join('\n'));
    await execFileAsync('openssl', ['verify', '-CAfile', caPath, certificatePath]);

    return [];
  } catch (error) {
    return [
      {
        code: 'certificate.chain_invalid',
        message: 'Certificate chain could not be verified against the provided CA bundle.',
        raw: errorMessage(error),
      },
    ];
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
