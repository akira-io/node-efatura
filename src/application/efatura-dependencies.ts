import type {
  CertificateValidator,
  Clock,
  DfaRenderer,
  EmitterAuthorizationClient,
  ExchangeRateProvider,
  GoldenVectorRepository,
  MiddlewareTransport,
  PlatformTransport,
  SequenceStore,
  SoftwareRegistryClient,
  TaxpayerRegistryClient,
  XmlSigner,
  XsdValidator,
} from '../core/contracts';
import type { DocumentTypePolicy } from '../core/contracts/document-type-policy';
import { DefaultDocumentTypePolicy } from '../domain/policies/default-document-type-policy';
import { SystemClock } from '../infrastructure/clock/system-clock';
import { BcvExchangeRateProvider } from '../infrastructure/currency/bcv-exchange-rate-provider';
import { PdfDfaRenderer } from '../infrastructure/dfa/pdf-dfa-renderer';
import {
  FetchEmitterAuthorizationClient,
  FetchSoftwareRegistryClient,
  FetchTaxpayerRegistryClient,
} from '../infrastructure/fiscal-authority/fetch-fiscal-authority-clients';
import { InMemoryGoldenVectorRepository } from '../infrastructure/golden-vectors/in-memory-golden-vector-repository';
import { FetchMiddlewareTransport } from '../infrastructure/middleware/fetch-middleware-transport';
import { FetchPlatformTransport } from '../infrastructure/middleware/fetch-platform-transport';
import { OpensslCertificateValidator } from '../infrastructure/signing/openssl-certificate-validator';
import { XadesBesSigner } from '../infrastructure/signing/xades-bes-signer';
import { InMemorySequenceStore } from '../infrastructure/storage/in-memory-sequence-store';
import { XmllintXsdValidator } from '../infrastructure/validation/xmllint-xsd-validator';
import type { EfaturaDependencies } from './efatura-options';

export interface ResolvedEfaturaDependencies {
  certificateValidator: CertificateValidator;
  documentTypePolicy: DocumentTypePolicy;
  clock: Clock;
  sequenceStore: SequenceStore;
  xsdValidator: XsdValidator;
  xmlSigner: XmlSigner;
  dfaRenderer: DfaRenderer;
  middlewareTransport: MiddlewareTransport;
  platformTransport: PlatformTransport;
  goldenVectors: GoldenVectorRepository;
  taxpayerRegistryClient: TaxpayerRegistryClient;
  softwareRegistryClient: SoftwareRegistryClient;
  emitterAuthorizationClient: EmitterAuthorizationClient;
  exchangeRateProvider: ExchangeRateProvider;
}

export function resolveEfaturaDependencies(
  dependencies: EfaturaDependencies,
): ResolvedEfaturaDependencies {
  const clock = dependencies.clock ?? new SystemClock();

  return {
    certificateValidator: dependencies.certificateValidator ?? new OpensslCertificateValidator(),
    documentTypePolicy: dependencies.documentTypePolicy ?? new DefaultDocumentTypePolicy(),
    clock,
    sequenceStore: dependencies.sequenceStore ?? new InMemorySequenceStore(),
    xsdValidator: dependencies.xsdValidator ?? new XmllintXsdValidator(),
    xmlSigner: dependencies.xmlSigner ?? new XadesBesSigner(),
    dfaRenderer: dependencies.dfaRenderer ?? new PdfDfaRenderer(),
    middlewareTransport: dependencies.middlewareTransport ?? new FetchMiddlewareTransport(),
    platformTransport: dependencies.platformTransport ?? new FetchPlatformTransport(),
    goldenVectors: dependencies.goldenVectors ?? new InMemoryGoldenVectorRepository(),
    taxpayerRegistryClient:
      dependencies.taxpayerRegistryClient ?? new FetchTaxpayerRegistryClient(),
    softwareRegistryClient:
      dependencies.softwareRegistryClient ?? new FetchSoftwareRegistryClient(),
    emitterAuthorizationClient:
      dependencies.emitterAuthorizationClient ?? new FetchEmitterAuthorizationClient(),
    exchangeRateProvider:
      dependencies.exchangeRateProvider ?? new BcvExchangeRateProvider({ clock }),
  };
}
