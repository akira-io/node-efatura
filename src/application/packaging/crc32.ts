const CRC_TABLE = new Uint32Array(256);

for (let index = 0; index < 256; index += 1) {
  let crc = index;

  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }

  CRC_TABLE[index] = crc >>> 0;
}

export function crc32(input: Buffer): number {
  let crc = 0xffffffff;

  for (const byte of input) {
    const tableIndex = (crc ^ byte) & 0xff;
    const tableValue = CRC_TABLE[tableIndex] ?? 0;

    crc = tableValue ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}
