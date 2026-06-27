import { execFile } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface TemporaryCertificate {
  directory: string;
  certificate: string;
  privateKey: string;
}

export interface TemporaryCertificateOptions {
  commonName?: string;
  serialNumber?: string;
  days?: number;
}

export async function temporaryCertificate(
  options: TemporaryCertificateOptions = {},
): Promise<TemporaryCertificate> {
  const directory = await mkdtemp(join(tmpdir(), 'efatura-certificate-'));
  const keyPath = join(directory, 'key.pem');
  const certificatePath = join(directory, 'cert.pem');

  await execFileAsync('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-sha256',
    '-nodes',
    '-keyout',
    keyPath,
    '-out',
    certificatePath,
    '-subj',
    `/CN=${options.commonName ?? 'Efatura Test'}`,
    '-set_serial',
    options.serialNumber ?? '1234567890',
    '-days',
    String(options.days ?? 1),
  ]);

  return {
    directory,
    certificate: await readFile(certificatePath, 'utf8'),
    privateKey: await readFile(keyPath, 'utf8'),
  };
}
