import type { SequenceScope, SequenceStore } from '../../core/contracts';
import { sequenceScopeKey } from '../../core/contracts';

export class InMemorySequenceStore implements SequenceStore {
  readonly #values = new Map<string, number>();

  async next(scope: SequenceScope): Promise<number> {
    const key = sequenceScopeKey(scope);
    const next = (this.#values.get(key) ?? 0) + 1;

    this.#values.set(key, next);

    return next;
  }

  async current(scope: SequenceScope): Promise<number | null> {
    return this.#values.get(sequenceScopeKey(scope)) ?? null;
  }

  async reset(scope: SequenceScope): Promise<void> {
    this.#values.delete(sequenceScopeKey(scope));
  }
}
