import type {
  CertificateValidator,
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
import type { BuildIudInput } from '../domain/iud/iud';
import type { InvoiceData } from '../domain/value-objects/invoice-data';
import type { EmissionMode } from './xml/dfe-xml';

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
  emissionMode?: EmissionMode;
}

export interface EfaturaBuildEventIdInput {
  issueDateTime: string;
  repositoryCode?: number | string;
  transmitterNif?: number | string;
}

export interface EfaturaBuildEventXmlOptions {
  id?: string;
  emissionMode?: EmissionMode;
}

export interface RenderDfaOptions {
  iud: string;
  invoice?: InvoiceData;
  emissionMode?: EmissionMode;
  title?: string;
  currency?: string;
}

export interface SubmitPlatformOptions {
  accessToken: string;
  baseUrl?: string;
}
