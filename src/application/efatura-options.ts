import type {
  CertificateValidator,
  Clock,
  DfaRenderer,
  EmitterAuthorizationClient,
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
import type { EmissionModeInput } from '../domain/enums/emission-mode';
import type { BuildIudInput } from '../domain/iud/iud';
import type { InvoiceData } from '../domain/value-objects/invoice-data';

export interface EfaturaDependencies {
  certificateValidator?: CertificateValidator;
  documentTypePolicy?: DocumentTypePolicy;
  clock?: Clock;
  sequenceStore?: SequenceStore;
  xsdValidator?: XsdValidator;
  xmlSigner?: XmlSigner;
  dfaRenderer?: DfaRenderer;
  middlewareTransport?: MiddlewareTransport;
  platformTransport?: PlatformTransport;
  goldenVectors?: GoldenVectorRepository;
  taxpayerRegistryClient?: TaxpayerRegistryClient;
  softwareRegistryClient?: SoftwareRegistryClient;
  emitterAuthorizationClient?: EmitterAuthorizationClient;
}

export interface EfaturaBuildIudInput
  extends Omit<BuildIudInput, 'repositoryCode' | 'emitterNif' | 'led'> {
  repositoryCode?: number | string;
  emitterNif?: number | string;
  led?: number | string;
}

export interface EfaturaBuildSequentialIudInput
  extends Omit<EfaturaBuildIudInput, 'documentNumber'> {
  documentNumber?: never;
}

export interface EfaturaBuildDfeXmlOptions {
  iud?: string;
  documentNumber?: number | string;
  randomCode?: number | string;
  emissionMode?: EmissionModeInput;
}

export interface EfaturaBuildEventIdInput {
  issueDateTime: string;
  repositoryCode?: number | string;
  transmitterNif?: number | string;
}

export interface EfaturaBuildEventXmlOptions {
  id?: string;
  emissionMode?: EmissionModeInput;
}

export interface RenderDfaOptions {
  iud: string;
  invoice?: InvoiceData;
  emissionMode?: EmissionModeInput;
  contingencyIuc?: string;
  title?: string;
  currency?: string;
}

export interface SubmitPlatformOptions {
  accessToken: string;
  baseUrl?: string;
}

export interface FiscalReadinessOptions {
  accessToken?: string;
  baseUrl?: string;
  validateReceiver?: boolean;
}
