import type { GoldenVector, GoldenVectorKind, GoldenVectorRepository } from '../../core/contracts';

export class InMemoryGoldenVectorRepository implements GoldenVectorRepository {
  readonly #vectors: GoldenVector[];

  constructor(vectors: GoldenVector[] = []) {
    this.#vectors = vectors;
  }

  async find(kind: GoldenVectorKind, name: string): Promise<GoldenVector | null> {
    return this.#vectors.find((vector) => vector.kind === kind && vector.name === name) ?? null;
  }

  async all(kind?: GoldenVectorKind): Promise<GoldenVector[]> {
    return kind ? this.#vectors.filter((vector) => vector.kind === kind) : [...this.#vectors];
  }
}
