import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import knexFactory, { type Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DocumentType } from '../src/domain/enums/document-type';
import { FileSequenceStore, InMemorySequenceStore } from '../src/infrastructure';
import { KnexSequenceStore } from '../src/infrastructure/storage/knex';

describe('KnexSequenceStore', () => {
  let knex: Knex;

  beforeEach(() => {
    knex = knexFactory({
      client: 'better-sqlite3',
      connection: {
        filename: ':memory:',
      },
      useNullAsDefault: true,
    });
  });

  afterEach(async () => {
    await knex.destroy();
  });

  it('persists sequential numbers by NIF, year, LED, and document type', async () => {
    const store = new KnexSequenceStore(knex);
    const scope = {
      nif: '100200300',
      year: 2026,
      led: '123',
      documentType: DocumentType.ElectronicInvoice,
    };

    await store.ensureSchema();

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
    const store = new KnexSequenceStore(knex);
    const scope = {
      nif: '100200300',
      year: 2026,
      led: '123',
      documentType: DocumentType.ElectronicInvoice,
    };

    await store.ensureSchema();

    const results = await Promise.all(Array.from({ length: 50 }, () => store.next(scope)));
    const unique = new Set(results);

    expect(unique.size).toBe(50);
    expect(Math.min(...results)).toBe(1);
    expect(Math.max(...results)).toBe(50);
    await expect(store.current(scope)).resolves.toBe(50);
  });

  it('handles sequence numbers beyond 32-bit integers', async () => {
    const store = new KnexSequenceStore(knex);
    const scope = {
      nif: '100200300',
      year: 2026,
      led: '123',
      documentType: DocumentType.ElectronicInvoice,
    };

    await store.ensureSchema();
    await knex('efatura_sequences').insert({
      emitter_nif: scope.nif,
      fiscal_year: scope.year,
      led_code: scope.led,
      document_type: scope.documentType,
      current_number: 3_000_000_000,
      created_at: 'seed',
      updated_at: 'seed',
    });

    await expect(store.next(scope)).resolves.toBe(3_000_000_001);
    await expect(store.current(scope)).resolves.toBe(3_000_000_001);
  });
});

describe('FileSequenceStore', () => {
  let directory: string;
  let store: FileSequenceStore;
  const scope = {
    nif: '100200300',
    year: 2026,
    led: '123',
    documentType: DocumentType.ElectronicInvoice,
  };

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'efatura-seq-'));
    store = new FileSequenceStore(join(directory, 'sequences.json'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('persists sequential numbers scoped by NIF, year, LED, and document type', async () => {
    await expect(store.current(scope)).resolves.toBeNull();
    await expect(store.next(scope)).resolves.toBe(1);
    await expect(store.next(scope)).resolves.toBe(2);
    await expect(store.next({ ...scope, year: 2027 })).resolves.toBe(1);
    await expect(store.current(scope)).resolves.toBe(2);

    await store.reset(scope);
    await expect(store.current(scope)).resolves.toBeNull();
  });

  it('persists durably across store instances on the same file', async () => {
    await store.next(scope);
    await store.next(scope);

    const reopened = new FileSequenceStore(join(directory, 'sequences.json'));

    await expect(reopened.current(scope)).resolves.toBe(2);
    await expect(reopened.next(scope)).resolves.toBe(3);
  });

  it('serializes concurrent next() calls into a gap-free unique sequence in-process', async () => {
    const results = await Promise.all(Array.from({ length: 50 }, () => store.next(scope)));
    const unique = new Set(results);

    expect(unique.size).toBe(50);
    expect(Math.min(...results)).toBe(1);
    expect(Math.max(...results)).toBe(50);
    await expect(store.current(scope)).resolves.toBe(50);
  });
});

describe('InMemorySequenceStore', () => {
  const scope = {
    nif: '100200300',
    year: 2026,
    led: '123',
    documentType: DocumentType.ElectronicInvoice,
  };

  it('tracks current, next, and reset by sequence scope', async () => {
    const store = new InMemorySequenceStore();

    await expect(store.current(scope)).resolves.toBeNull();
    await expect(store.next(scope)).resolves.toBe(1);
    await expect(store.next(scope)).resolves.toBe(2);
    await expect(
      store.next({ ...scope, documentType: DocumentType.ElectronicCreditNote }),
    ).resolves.toBe(1);
    await expect(store.current(scope)).resolves.toBe(2);

    await store.reset(scope);

    await expect(store.current(scope)).resolves.toBeNull();
  });

  it('produces a gap-free unique sequence under concurrent next() calls', async () => {
    const store = new InMemorySequenceStore();
    const results = await Promise.all(Array.from({ length: 50 }, () => store.next(scope)));
    const unique = new Set(results);

    expect(unique.size).toBe(50);
    expect(Math.min(...results)).toBe(1);
    expect(Math.max(...results)).toBe(50);
    await expect(store.current(scope)).resolves.toBe(50);
  });
});
