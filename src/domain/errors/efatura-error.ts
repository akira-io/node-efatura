export class EfaturaError extends Error {}

export class EfaturaValidationError extends EfaturaError {
  constructor(
    readonly field: string,
    message: string,
    readonly code: string | null = null,
  ) {
    super(message);
    this.name = 'EfaturaValidationError';
  }
}

export class OfficialArtifactMissingError extends EfaturaError {
  constructor(
    readonly artifact: string,
    message = `Official ${artifact} artifact is required for this operation.`,
  ) {
    super(message);
    this.name = 'OfficialArtifactMissingError';
  }
}
