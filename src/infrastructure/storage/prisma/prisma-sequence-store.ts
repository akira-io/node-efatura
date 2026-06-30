import type { SequenceScope, SequenceStore } from '../../../core/contracts';
import { sequenceScopeKey } from '../../../core/contracts';

type SequenceRecord = { currentNumber: bigint };

export interface PrismaSequenceDelegate {
  findUnique(args: {
    where: { id: string };
    select: { currentNumber: true };
  }): Promise<SequenceRecord | null>;
  upsert(args: {
    where: { id: string };
    create: { id: string; currentNumber: bigint };
    update: { currentNumber: { increment: bigint } };
    select: { currentNumber: true };
  }): Promise<SequenceRecord>;
  deleteMany(args: { where: { id: string } }): Promise<unknown>;
}

export class PrismaSequenceStore implements SequenceStore {
  readonly #delegate: PrismaSequenceDelegate;

  constructor(delegate: PrismaSequenceDelegate) {
    this.#delegate = delegate;
  }

  async next(scope: SequenceScope): Promise<number> {
    const id = sequenceScopeKey(scope);
    const record = await this.#delegate.upsert({
      where: { id },
      create: { id, currentNumber: 1n },
      update: { currentNumber: { increment: 1n } },
      select: { currentNumber: true },
    });

    return Number(record.currentNumber);
  }

  async current(scope: SequenceScope): Promise<number | null> {
    const record = await this.#delegate.findUnique({
      where: { id: sequenceScopeKey(scope) },
      select: { currentNumber: true },
    });

    return record ? Number(record.currentNumber) : null;
  }

  async reset(scope: SequenceScope): Promise<void> {
    await this.#delegate.deleteMany({ where: { id: sequenceScopeKey(scope) } });
  }
}
