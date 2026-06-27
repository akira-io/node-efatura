import { assertContingencyMatchesEmissionMode } from './application/contingency-validation';
import { dfaQrCodeUrl } from './application/dfa/dfa';
import { dfaRenderInputFrom } from './application/dfa/dfa-render-input';
import { resolveEfaturaDependencies } from './application/efatura-dependencies';
import {
  isInvoiceData,
  normalizeDocumentTypeForSequence,
  normalizeIssueDate,
  requireDocumentNumber,
} from './application/efatura-normalizers';
import type {
  EfaturaBuildDfeXmlOptions,
  EfaturaBuildEventIdInput,
  EfaturaBuildEventXmlOptions,
  EfaturaBuildIudInput,
  EfaturaBuildSequentialIudInput,
  EfaturaDependencies,
  RenderDfaOptions,
  SubmitPlatformOptions,
} from './application/efatura-options';
import {
  buildEventIdForConfig,
  buildEventXmlForConfig,
} from './application/events/event-xml-request';
import { assertGoldenVector as assertGoldenVectorValue } from './application/golden-vector-assertion';
import { validateIssueDateTolerance } from './application/issue-date-validation';
import { buildDfeZip } from './application/packaging/dfe-zip';
import { type BuildDfeXmlInput, buildDfeXml, DFE_XML_VERSION } from './application/xml/dfe-xml';
import { configAsArray, type EfaturaConfigArray, type ResolvedEfaturaConfig } from './config';
import type {
  CertificateValidationInput,
  CertificateValidationResult,
  CertificateValidator,
  Clock,
  DfaDocument,
  DfaRenderer,
  GoldenVectorKind,
  GoldenVectorRepository,
  MiddlewareSubmissionResult,
  MiddlewareTransport,
  PlatformSubmissionResult,
  PlatformTransport,
  SequenceStore,
  SignedXmlResult,
  XmlSigner,
  XmlSigningOptions,
  XsdValidationResult,
  XsdValidator,
} from './core/contracts';
import type { DocumentType } from './domain/enums/document-type';
import { EfaturaValidationError } from './domain/errors';
import { buildIud } from './domain/iud/iud';
import { type EventData, eventDataFrom } from './domain/value-objects/event-data';
import type { InvoiceData } from './domain/value-objects/invoice-data';
import { EfaturaDocuments } from './efatura-documents';

export class Efatura extends EfaturaDocuments {
  readonly certificateValidator: CertificateValidator;
  readonly clock: Clock;
  readonly sequenceStore: SequenceStore;
  readonly xsdValidator: XsdValidator;
  readonly xmlSigner: XmlSigner;
  readonly dfaRenderer: DfaRenderer;
  readonly middlewareTransport: MiddlewareTransport;
  readonly platformTransport: PlatformTransport;
  readonly goldenVectors: GoldenVectorRepository;

  constructor(config: ResolvedEfaturaConfig, dependencies: EfaturaDependencies = {}) {
    const resolvedDependencies = resolveEfaturaDependencies(dependencies);

    super(config, resolvedDependencies.documentTypePolicy);
    this.certificateValidator = resolvedDependencies.certificateValidator;
    this.clock = resolvedDependencies.clock;
    this.sequenceStore = resolvedDependencies.sequenceStore;
    this.xsdValidator = resolvedDependencies.xsdValidator;
    this.xmlSigner = resolvedDependencies.xmlSigner;
    this.dfaRenderer = resolvedDependencies.dfaRenderer;
    this.middlewareTransport = resolvedDependencies.middlewareTransport;
    this.platformTransport = resolvedDependencies.platformTransport;
    this.goldenVectors = resolvedDependencies.goldenVectors;
  }

  generateSubmissionId(): string {
    return this.config.generators.submissionId();
  }

  generateBatchId(): string {
    return this.config.generators.batchId();
  }

  async nextDocumentNumber(issueDate: string, documentType: DocumentType): Promise<number> {
    return this.sequenceStore.next({
      nif: this.config.transmitterNif,
      year: Number(issueDate.slice(0, 4)),
      led: this.config.transmitterLed,
      documentType,
    });
  }

  buildIud(input: EfaturaBuildIudInput): string {
    return buildIud({
      ...input,
      repositoryCode: input.repositoryCode ?? this.config.repositoryCode,
      emitterNif: input.emitterNif ?? this.config.transmitterNif,
      led: input.led ?? this.config.transmitterLed,
    });
  }

  buildEventId(input: EfaturaBuildEventIdInput): string {
    return buildEventIdForConfig(input, this.config);
  }

  async buildSequentialIud(input: EfaturaBuildSequentialIudInput): Promise<string> {
    const issueDate = normalizeIssueDate(input.issueDate);
    const documentType = normalizeDocumentTypeForSequence(input.documentType);
    const documentNumber = await this.nextDocumentNumber(issueDate, documentType);

    return this.buildIud({ ...input, issueDate, documentType, documentNumber });
  }

  buildDfeXml(
    data: Record<string, unknown> | InvoiceData,
    options: EfaturaBuildDfeXmlOptions,
  ): string {
    const invoice = isInvoiceData(data) ? data : this.validateInvoice(data);
    const emissionMode = options.emissionMode ?? 'Online';

    validateIssueDateTolerance({
      issueDate: invoice.issueDate,
      issueTime: invoice.issueTime,
      emissionMode,
      clock: this.clock,
    });
    assertContingencyMatchesEmissionMode(invoice, emissionMode);

    const iud =
      options.iud ??
      this.buildIud({
        issueDate: invoice.issueDate,
        documentType: invoice.type,
        documentNumber: requireDocumentNumber(options.documentNumber),
        randomCode: options.randomCode,
      });
    const input: BuildDfeXmlInput = {
      iud,
      invoice,
      config: this.config,
      emissionMode,
    };

    return buildDfeXml(input);
  }

  validateEvent(data: Record<string, unknown>): EventData {
    return eventDataFrom(data);
  }

  buildEventXml(
    data: Record<string, unknown> | EventData,
    options: EfaturaBuildEventXmlOptions = {},
  ): string {
    return buildEventXmlForConfig(data, options, this.config);
  }

  validateDfeXml(xml: string, documentType: DocumentType): Promise<XsdValidationResult> {
    return this.xsdValidator.validate(xml, {
      documentKind: 'dfe',
      documentType,
      schemaVersion: DFE_XML_VERSION,
    });
  }

  validateEventXml(xml: string): Promise<XsdValidationResult> {
    return this.xsdValidator.validate(xml, {
      documentKind: 'event',
      schemaVersion: DFE_XML_VERSION,
    });
  }

  signDfeXml(xml: string, options: XmlSigningOptions = {}): Promise<SignedXmlResult> {
    return this.xmlSigner.sign(xml, options);
  }

  signEventXml(xml: string, options: XmlSigningOptions = {}): Promise<SignedXmlResult> {
    return this.xmlSigner.sign(xml, options);
  }

  validateCertificate(input: CertificateValidationInput): Promise<CertificateValidationResult> {
    return this.certificateValidator.validate(input);
  }

  buildDfeZip(files: Array<{ iud: string; xml: string | Buffer }>): Buffer {
    return buildDfeZip(files);
  }

  async submitDfeZip(zip: Buffer): Promise<MiddlewareSubmissionResult> {
    const transmitterKey = this.config.transmitterKey;

    if (!transmitterKey) {
      throw new EfaturaValidationError(
        'transmitter.key',
        'Transmitter key is required for middleware submission.',
        'middleware.transmitter_key_required',
      );
    }

    return this.middlewareTransport.submitDfeZip({
      zip,
      baseUrl: this.config.middlewareBaseUrl,
      transmitterKey,
    });
  }

  submitDfeZipToPlatform(
    zip: Buffer,
    options: SubmitPlatformOptions,
  ): Promise<PlatformSubmissionResult> {
    return this.platformTransport.submitDfeZip({
      zip,
      baseUrl: options.baseUrl ?? this.config.platformBaseUrl,
      accessToken: options.accessToken,
      repositoryCode: this.config.repositoryCode,
    });
  }

  dfaQrCodeUrl(iud: string): string {
    return dfaQrCodeUrl(iud, this.config.dfaBaseUrl);
  }

  async renderDfa(options: RenderDfaOptions): Promise<DfaDocument> {
    return this.dfaRenderer.render(dfaRenderInputFrom(options, this.dfaQrCodeUrl(options.iud)));
  }

  assertGoldenVector(kind: GoldenVectorKind, name: string, actual: string): Promise<void> {
    return assertGoldenVectorValue(this.goldenVectors, kind, name, actual);
  }

  configArray(): EfaturaConfigArray {
    return configAsArray(this.config);
  }
}
