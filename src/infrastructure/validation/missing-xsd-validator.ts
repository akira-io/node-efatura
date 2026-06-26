import type { XsdValidationContext, XsdValidationResult, XsdValidator } from '../../core/contracts';
import { OfficialArtifactMissingError } from '../../domain/errors';

export class MissingOfficialXsdValidator implements XsdValidator {
  async validate(_xml: string, context: XsdValidationContext): Promise<XsdValidationResult> {
    throw new OfficialArtifactMissingError(
      'XSD',
      `Official XSD schema is required to validate ${context.documentType} v${context.schemaVersion}.`,
    );
  }
}
