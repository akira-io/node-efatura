import type { SignedXmlResult, XmlSigner, XmlSigningOptions } from '../../core/contracts';
import { OfficialArtifactMissingError } from '../../domain/errors';

export class MissingXadesBesSigner implements XmlSigner {
  async sign(_xml: string, _options: XmlSigningOptions = {}): Promise<SignedXmlResult> {
    throw new OfficialArtifactMissingError(
      'XAdES-BES signer',
      'A certificate-backed XAdES-BES signer is required to sign DFE XML.',
    );
  }
}
