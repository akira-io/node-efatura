import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { dfaContingencyNotice, dfaQrCodeUrl } from '../src/application/dfa/dfa';
import { buildDfeZip } from '../src/application/packaging/dfe-zip';
import type { MiddlewareSubmitInput } from '../src/core/contracts';
import { createEfatura } from '../src/create-efatura';
import { EmissionMode } from '../src/domain/enums/emission-mode';
import { dfaPdfContingencyLines } from '../src/infrastructure/dfa/pdf-dfa-renderer';

const iud = 'CV3260208100200300001230100000000112345678909';

describe('middleware packaging', () => {
  it('packages DFE XML files into a Deflate ZIP named by IUD', () => {
    const xml = '<Dfe></Dfe>';
    const zip = buildDfeZip([{ iud, xml }]);
    const filenameLength = zip.readUInt16LE(26);
    const compressedSize = zip.readUInt32LE(18);
    const filename = zip.subarray(30, 30 + filenameLength).toString('utf8');
    const compressed = zip.subarray(30 + filenameLength, 30 + filenameLength + compressedSize);

    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    expect(filename).toBe(`${iud}.xml`);
    expect(inflateRawSync(compressed).toString('utf8')).toBe(xml);
    expect(zip.includes(Buffer.from([0x50, 0x4b, 0x05, 0x06]))).toBe(true);
  });

  it('submits ZIP payloads through the configured middleware transport', async () => {
    const calls: MiddlewareSubmitInput[] = [];
    const efatura = createEfatura(
      {
        transmitterNif: '100200300',
        transmitterLed: '123',
        transmitterKey: 'k'.repeat(64),
        softwareCode: 'SW001',
        softwareName: 'Efatura Suite',
        softwareVersion: '1.0.0',
        middlewareBaseUrl: 'https://localhost:3443',
      },
      {
        middlewareTransport: {
          async submitDfeZip(input) {
            calls.push(input);

            return {
              ok: true,
              status: 202,
              statusText: 'Accepted',
              rawBody: 'accepted',
              body: 'accepted',
              documents: [],
              errors: [],
            };
          },
        },
      },
    );
    const zip = buildDfeZip([{ iud, xml: '<Dfe></Dfe>' }]);
    const response = await efatura.submitDfeZip(zip);

    expect(response.ok).toBe(true);
    expect(response.status).toBe(202);
    expect(calls[0]?.baseUrl).toBe('https://localhost:3443');
    expect(calls[0]?.transmitterKey).toBe('k'.repeat(64));
    expect(calls[0]?.zip).toBe(zip);
  });
});

describe('DFA helpers', () => {
  it('builds QR code URLs and contingency notices', () => {
    expect(dfaQrCodeUrl(iud, 'https://pe.efatura.cv/dfe/view')).toBe(
      `https://pe.efatura.cv/dfe/view/${iud}`,
    );
    expect(dfaContingencyNotice(true)).toBe('EMITIDO EM CONTINGENCIA');
    expect(dfaContingencyNotice(EmissionMode.Offline)).toBe('EMITIDO EM CONTINGENCIA OFFLINE');
    expect(dfaContingencyNotice(EmissionMode.Off)).toBe('EMITIDO EM CONTINGENCIA OFF');
    expect(dfaContingencyNotice(false)).toBeNull();
  });

  it('rejects a non-https or malformed DFA base URL', () => {
    expect(() => dfaQrCodeUrl(iud, 'http://pe.efatura.cv/dfe/view')).toThrow(/https/);
    expect(() => dfaQrCodeUrl(iud, 'javascript:alert(1)')).toThrow();
    expect(() => dfaQrCodeUrl(iud, 'not a url')).toThrow();
  });

  it('uses the configured DFA base URL from the facade', () => {
    const efatura = createEfatura({
      transmitterNif: '100200300',
      transmitterLed: '123',
      softwareCode: 'SW001',
      softwareName: 'Efatura Suite',
      softwareVersion: '1.0.0',
      middlewareBaseUrl: 'https://localhost:3443',
      dfaBaseUrl: 'https://portal.example/dfe',
    });

    expect(efatura.dfaQrCodeUrl(iud)).toBe(`https://portal.example/dfe/${iud}`);
  });

  it('builds PDF contingency lines for every emission mode', () => {
    expect(dfaPdfContingencyLines({ emissionMode: EmissionMode.Online })).toEqual([]);
    expect(dfaPdfContingencyLines({ emissionMode: EmissionMode.Offline })).toEqual([
      'EMITIDO EM CONTINGENCIA OFFLINE',
      'Pendente de Autorizacao',
    ]);
    expect(
      dfaPdfContingencyLines({ emissionMode: EmissionMode.Off, contingencyIuc: 'IUC-123' }),
    ).toEqual(['EMITIDO EM CONTINGENCIA OFF', 'IUC: IUC-123', 'Pendente de Autorizacao']);
  });
});
