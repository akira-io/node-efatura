import type { GoldenVectorKind, GoldenVectorRepository } from '../core/contracts';
import { EfaturaValidationError, OfficialArtifactMissingError } from '../domain/errors';

export async function assertGoldenVector(
  repository: GoldenVectorRepository,
  kind: GoldenVectorKind,
  name: string,
  actual: string,
): Promise<void> {
  const vector = await repository.find(kind, name);

  if (!vector) {
    throw new OfficialArtifactMissingError(
      'golden vector',
      `Official golden vector ${kind}:${name} is required for this assertion.`,
    );
  }

  if (vector.expected !== actual) {
    throw new EfaturaValidationError(
      `goldenVectors.${kind}.${name}`,
      `Golden vector ${kind}:${name} did not match.`,
      'golden_vector.mismatch',
    );
  }
}
