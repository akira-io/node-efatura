import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DocumentType } from '../src/domain/enums/document-type';
import { PrismaSequenceStore } from '../src/infrastructure/storage/prisma';

const schemaDirectory = join(process.cwd(), 'tests', 'prisma');
const schemaPath = join(schemaDirectory, 'schema.prisma');
const dbPath = join(schemaDirectory, 'test.db');

// biome-ignore lint/suspicious/noExplicitAny: generated Prisma client is loaded dynamically
let prisma: any;

beforeAll(async () => {
  await mkdir(schemaDirectory, { recursive: true });

  const fragment = await readFile(join(process.cwd(), 'prisma', 'efatura-sequence.prisma'), 'utf8');
  const header = [
    'generator client {',
    '  provider = "prisma-client-js"',
    '}',
    '',
    'datasource db {',
    '  provider = "sqlite"',
    '}',
    '',
  ].join('\n');

  await writeFile(schemaPath, `${header}${fragment}`);

  execFileSync('bunx', ['prisma', 'generate', `--schema=${schemaPath}`], { stdio: 'pipe' });
  execFileSync(
    'bunx',
    ['prisma', 'db', 'push', `--schema=${schemaPath}`, '--force-reset', `--url=file:${dbPath}`],
    {
      stdio: 'pipe',
      env: { ...process.env, PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: 'yes' },
    },
  );

  const { PrismaClient } = await import('@prisma/client');
  const { PrismaBetterSqlite3 } = await import('@prisma/adapter-better-sqlite3');
  const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
  prisma = new PrismaClient({ adapter });
}, 120_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await rm(dbPath, { force: true });
});

beforeEach(async () => {
  await prisma.efaturaSequence.deleteMany({});
});

describe('PrismaSequenceStore', () => {
  const scope = {
    nif: '100200300',
    year: 2026,
    led: '123',
    documentType: DocumentType.ElectronicInvoice,
  };

  it('persists sequential numbers scoped by NIF, year, LED, and document type', async () => {
    const store = new PrismaSequenceStore(prisma.efaturaSequence);

    await expect(store.current(scope)).resolves.toBeNull();
    await expect(store.next(scope)).resolves.toBe(1);
    await expect(store.next(scope)).resolves.toBe(2);
    await expect(store.current(scope)).resolves.toBe(2);
    await expect(
      store.next({ ...scope, documentType: DocumentType.ElectronicCreditNote }),
    ).resolves.toBe(1);
    await expect(store.next({ ...scope, year: 2027 })).resolves.toBe(1);

    await store.reset(scope);

    await expect(store.current(scope)).resolves.toBeNull();
    await expect(store.next(scope)).resolves.toBe(1);
  });

  it('produces a gap-free unique sequence under concurrent next() calls', async () => {
    const store = new PrismaSequenceStore(prisma.efaturaSequence);

    const results = await Promise.all(Array.from({ length: 50 }, () => store.next(scope)));
    const unique = new Set(results);

    expect(unique.size).toBe(50);
    expect(Math.min(...results)).toBe(1);
    expect(Math.max(...results)).toBe(50);
    await expect(store.current(scope)).resolves.toBe(50);
  });

  it('handles sequence numbers beyond 32-bit integers', async () => {
    const store = new PrismaSequenceStore(prisma.efaturaSequence);

    await prisma.efaturaSequence.create({
      data: {
        id: `${scope.nif}:${scope.year}:${scope.led}:${scope.documentType}`,
        currentNumber: 3_000_000_000n,
      },
    });

    await expect(store.next(scope)).resolves.toBe(3_000_000_001);
    await expect(store.current(scope)).resolves.toBe(3_000_000_001);
  });
});
