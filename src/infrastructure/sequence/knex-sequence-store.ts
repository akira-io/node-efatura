import type { Knex } from 'knex';
import type { SequenceScope, SequenceStore } from '../../core/contracts';

export interface KnexSequenceStoreOptions {
  tableName?: string;
}

interface SequenceRow {
  emitter_nif: string;
  fiscal_year: number;
  led_code: string;
  document_type: string;
  current_number: number;
  created_at: string;
  updated_at: string;
}

type SequenceKey = Pick<SequenceRow, 'document_type' | 'emitter_nif' | 'fiscal_year' | 'led_code'>;

export class KnexSequenceStore implements SequenceStore {
  readonly #knex: Knex;
  readonly #tableName: string;

  constructor(knex: Knex, options: KnexSequenceStoreOptions = {}) {
    this.#knex = knex;
    this.#tableName = options.tableName ?? 'efatura_sequences';
  }

  async ensureSchema(): Promise<void> {
    const exists = await this.#knex.schema.hasTable(this.#tableName);

    if (exists) {
      return;
    }

    await this.#knex.schema.createTable(this.#tableName, (table) => {
      table.string('emitter_nif', 9).notNullable();
      table.integer('fiscal_year').notNullable();
      table.string('led_code', 5).notNullable();
      table.string('document_type', 3).notNullable();
      table.integer('current_number').notNullable();
      table.string('created_at').notNullable();
      table.string('updated_at').notNullable();
      table.primary(['emitter_nif', 'fiscal_year', 'led_code', 'document_type']);
    });
  }

  async next(scope: SequenceScope): Promise<number> {
    return this.#knex.transaction(async (transaction) => {
      const key = sequenceKey(scope);
      const row = await transaction<SequenceRow>(this.#tableName).where(key).forUpdate().first();
      const next = (row?.current_number ?? 0) + 1;
      const now = new Date().toISOString();

      if (!row) {
        await transaction<SequenceRow>(this.#tableName).insert({
          ...key,
          current_number: next,
          created_at: now,
          updated_at: now,
        });

        return next;
      }

      await transaction<SequenceRow>(this.#tableName).where(key).update({
        current_number: next,
        updated_at: now,
      });

      return next;
    });
  }

  async current(scope: SequenceScope): Promise<number | null> {
    const row = await this.#knex<SequenceRow>(this.#tableName).where(sequenceKey(scope)).first();

    return row?.current_number ?? null;
  }

  async reset(scope: SequenceScope): Promise<void> {
    await this.#knex<SequenceRow>(this.#tableName).where(sequenceKey(scope)).delete();
  }
}

function sequenceKey(scope: SequenceScope): SequenceKey {
  return {
    emitter_nif: scope.nif,
    fiscal_year: scope.year,
    led_code: scope.led,
    document_type: scope.documentType,
  };
}
