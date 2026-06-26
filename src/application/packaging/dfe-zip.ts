import { deflateRawSync } from 'node:zlib';
import { EfaturaValidationError } from '../../domain/errors';
import { validateIud } from '../../domain/iud/iud';
import { crc32 } from './crc32';

export interface DfeZipFile {
  iud: string;
  xml: string | Buffer;
}

interface ZipEntry {
  filename: string;
  crc: number;
  compressed: Buffer;
  uncompressedSize: number;
  localHeaderOffset: number;
}

export function buildDfeZip(files: DfeZipFile[]): Buffer {
  if (files.length === 0) {
    throw new EfaturaValidationError(
      'files',
      'At least one DFE XML file is required.',
      'zip.empty',
    );
  }

  const localParts: Buffer[] = [];
  const entries: ZipEntry[] = [];
  let offset = 0;

  for (const file of files) {
    if (!validateIud(file.iud)) {
      throw new EfaturaValidationError('iud', 'IUD is invalid.', 'zip.iud_invalid');
    }

    const filename = `${file.iud}.xml`;
    const content = Buffer.isBuffer(file.xml) ? file.xml : Buffer.from(file.xml, 'utf8');
    const compressed = deflateRawSync(content, { level: 9 });
    const entry: ZipEntry = {
      filename,
      crc: crc32(content),
      compressed,
      uncompressedSize: content.length,
      localHeaderOffset: offset,
    };
    const localHeader = localFileHeader(entry);
    const filenameBuffer = Buffer.from(filename, 'utf8');

    localParts.push(localHeader, filenameBuffer, compressed);
    offset += localHeader.length + filenameBuffer.length + compressed.length;
    entries.push(entry);
  }

  const centralDirectoryOffset = offset;
  const centralParts = entries.map(centralDirectoryHeader);
  const centralDirectorySize = centralParts.reduce((size, part) => size + part.length, 0);
  const end = endOfCentralDirectory(entries.length, centralDirectorySize, centralDirectoryOffset);

  return Buffer.concat([...localParts, ...centralParts, end]);
}

function localFileHeader(entry: ZipEntry): Buffer {
  const filename = Buffer.from(entry.filename, 'utf8');
  const header = Buffer.alloc(30);

  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(8, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt32LE(entry.crc, 14);
  header.writeUInt32LE(entry.compressed.length, 18);
  header.writeUInt32LE(entry.uncompressedSize, 22);
  header.writeUInt16LE(filename.length, 26);
  header.writeUInt16LE(0, 28);

  return header;
}

function centralDirectoryHeader(entry: ZipEntry): Buffer {
  const filename = Buffer.from(entry.filename, 'utf8');
  const header = Buffer.alloc(46);

  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(8, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt16LE(0, 14);
  header.writeUInt32LE(entry.crc, 16);
  header.writeUInt32LE(entry.compressed.length, 20);
  header.writeUInt32LE(entry.uncompressedSize, 24);
  header.writeUInt16LE(filename.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(entry.localHeaderOffset, 42);

  return Buffer.concat([header, filename]);
}

function endOfCentralDirectory(
  entryCount: number,
  centralDirectorySize: number,
  centralDirectoryOffset: number,
): Buffer {
  const header = Buffer.alloc(22);

  header.writeUInt32LE(0x06054b50, 0);
  header.writeUInt16LE(0, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(entryCount, 8);
  header.writeUInt16LE(entryCount, 10);
  header.writeUInt32LE(centralDirectorySize, 12);
  header.writeUInt32LE(centralDirectoryOffset, 16);
  header.writeUInt16LE(0, 20);

  return header;
}
