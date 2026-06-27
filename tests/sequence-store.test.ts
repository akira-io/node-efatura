import knexFactory, { type Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DocumentType } from '../src/domain/enums/document-type';
import { KnexSequenceStore } from '../src/infrastructure';

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
});
