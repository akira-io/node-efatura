export type GoldenVectorKind = 'iud' | 'xml' | 'zip' | 'signature';

export interface GoldenVector {
  kind: GoldenVectorKind;
  name: string;
  expected: string;
  metadata?: Record<string, unknown>;
}

export interface GoldenVectorRepository {
  find(kind: GoldenVectorKind, name: string): Promise<GoldenVector | null>;
  all?(kind?: GoldenVectorKind): Promise<GoldenVector[]>;
}
