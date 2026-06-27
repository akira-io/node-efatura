import type {
  Clock,
  DfaRenderer,
  GoldenVectorRepository,
  MiddlewareTransport,
  PlatformTransport,
  SequenceStore,
  XmlSigner,
  XsdValidator,
} from '../core/contracts';
import type { DocumentTypePolicy } from '../core/contracts/document-type-policy';
import { DefaultDocumentTypePolicy } from '../domain/policies/default-document-type-policy';
import { SystemClock } from '../infrastructure/clock/system-clock';
import { PdfDfaRenderer } from '../infrastructure/dfa/pdf-dfa-renderer';
import { InMemoryGoldenVectorRepository } from '../infrastructure/golden-vectors/in-memory-golden-vector-repository';
import { FetchMiddlewareTransport } from '../infrastructure/middleware/fetch-middleware-transport';
import { FetchPlatformTransport } from '../infrastructure/middleware/fetch-platform-transport';
import { InMemorySequenceStore } from '../infrastructure/sequence/in-memory-sequence-store';
import { XadesBesSigner } from '../infrastructure/signing/xades-bes-signer';
import { XmllintXsdValidator } from '../infrastructure/validation/xmllint-xsd-validator';
import type { EfaturaDependencies } from './efatura-options';

export interface ResolvedEfaturaDependencies {
  documentTypePolicy: DocumentTypePolicy;
  clock: Clock;
  sequenceStore: SequenceStore;
  xsdValidator: XsdValidator;
  xmlSigner: XmlSigner;
  dfaRenderer: DfaRenderer;
  middlewareTransport: MiddlewareTransport;
  platformTransport: PlatformTransport;
  goldenVectors: GoldenVectorRepository;
}

export function resolveEfaturaDependencies(
  dependencies: EfaturaDependencies,
): ResolvedEfaturaDependencies {
  return {
    documentTypePolicy: dependencies.documentTypePolicy ?? new DefaultDocumentTypePolicy(),
    clock: dependencies.clock ?? new SystemClock(),
    sequenceStore: dependencies.sequenceStore ?? new InMemorySequenceStore(),
    xsdValidator: dependencies.xsdValidator ?? new XmllintXsdValidator(),
    xmlSigner: dependencies.xmlSigner ?? new XadesBesSigner(),
    dfaRenderer: dependencies.dfaRenderer ?? new PdfDfaRenderer(),
    middlewareTransport: dependencies.middlewareTransport ?? new FetchMiddlewareTransport(),
    platformTransport: dependencies.platformTransport ?? new FetchPlatformTransport(),
    goldenVectors: dependencies.goldenVectors ?? new InMemoryGoldenVectorRepository(),
  };
}
