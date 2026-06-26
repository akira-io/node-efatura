import { InvoiceBuilder } from './application/builders/invoice-builder';
import { dfaQrCodeUrl } from './application/dfa/dfa';
import {
  isInvoiceData,
  normalizeDocumentTypeForSequence,
  normalizeIssueDate,
  requireDocumentNumber,
} from './application/efatura-normalizers';
import type {
  EfaturaBuildDfeXmlOptions,
  EfaturaBuildIudInput,
  EfaturaBuildSequentialIudInput,
  EfaturaDependencies,
  RenderDfaOptions,
  SubmitPlatformOptions,
} from './application/efatura-options';
import { assertGoldenVector as assertGoldenVectorValue } from './application/golden-vector-assertion';
import { validateIssueDateTolerance } from './application/issue-date-validation';
import { buildDfeZip } from './application/packaging/dfe-zip';
import { type BuildDfeXmlInput, buildDfeXml, DFE_XML_VERSION } from './application/xml/dfe-xml';
import { configAsArray, type EfaturaConfigArray, type ResolvedEfaturaConfig } from './config';
import type {
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
import type { DocumentTypePolicy } from './core/contracts/document-type-policy';
import type { DocumentType } from './domain/enums/document-type';
import { EfaturaValidationError } from './domain/errors';
import { buildIud } from './domain/iud/iud';
import { DefaultDocumentTypePolicy } from './domain/policies/default-document-type-policy';
import {
  creditNoteDataFrom,
  debitNoteDataFrom,
  electronicInvoiceDataFrom,
  electronicReceiptDataFrom,
  entryNoteDataFrom,
  receiptInvoiceDataFrom,
  returnNoteDataFrom,
  salesReceiptDataFrom,
  transportDocumentDataFrom,
  type WrappedInvoiceData,
} from './domain/value-objects/documents';
import { type InvoiceData, invoiceDataFrom } from './domain/value-objects/invoice-data';
import { SystemClock } from './infrastructure/clock/system-clock';
import { PdfDfaRenderer } from './infrastructure/dfa/pdf-dfa-renderer';
import { InMemoryGoldenVectorRepository } from './infrastructure/golden-vectors/in-memory-golden-vector-repository';
import { FetchMiddlewareTransport } from './infrastructure/middleware/fetch-middleware-transport';
import { FetchPlatformTransport } from './infrastructure/middleware/fetch-platform-transport';
import { InMemorySequenceStore } from './infrastructure/sequence/in-memory-sequence-store';
import { MissingXadesBesSigner } from './infrastructure/signing/missing-xml-signer';
import { MissingOfficialXsdValidator } from './infrastructure/validation/missing-xsd-validator';

export type {
  EfaturaBuildDfeXmlOptions,
  EfaturaBuildIudInput,
  EfaturaBuildSequentialIudInput,
  EfaturaDependencies,
  RenderDfaOptions,
  SubmitPlatformOptions,
} from './application/efatura-options';

export class Efatura {
  readonly documentTypePolicy: DocumentTypePolicy;
  readonly clock: Clock;
  readonly sequenceStore: SequenceStore;
  readonly xsdValidator: XsdValidator;
  readonly xmlSigner: XmlSigner;
  readonly dfaRenderer: DfaRenderer;
  readonly middlewareTransport: MiddlewareTransport;
  readonly platformTransport: PlatformTransport;
  readonly goldenVectors: GoldenVectorRepository;

  constructor(
    readonly config: ResolvedEfaturaConfig,
    dependencies: EfaturaDependencies = {},
  ) {
    this.documentTypePolicy = dependencies.documentTypePolicy ?? new DefaultDocumentTypePolicy();
    this.clock = dependencies.clock ?? new SystemClock();
    this.sequenceStore = dependencies.sequenceStore ?? new InMemorySequenceStore();
    this.xsdValidator = dependencies.xsdValidator ?? new MissingOfficialXsdValidator();
    this.xmlSigner = dependencies.xmlSigner ?? new MissingXadesBesSigner();
    this.dfaRenderer = dependencies.dfaRenderer ?? new PdfDfaRenderer();
    this.middlewareTransport = dependencies.middlewareTransport ?? new FetchMiddlewareTransport();
    this.platformTransport = dependencies.platformTransport ?? new FetchPlatformTransport();
    this.goldenVectors = dependencies.goldenVectors ?? new InMemoryGoldenVectorRepository();
  }

  invoice(): InvoiceBuilder {
    return new InvoiceBuilder(
      (data) => this.validateInvoice(data),
      () => this.generateDocumentId(),
    );
  }

  validateInvoice(data: Record<string, unknown>): InvoiceData {
    return invoiceDataFrom(data, { documentTypePolicy: this.documentTypePolicy });
  }

  electronicInvoice(data: Record<string, unknown>): WrappedInvoiceData {
    return electronicInvoiceDataFrom(data, { documentTypePolicy: this.documentTypePolicy });
  }

  receiptInvoice(data: Record<string, unknown>): WrappedInvoiceData {
    return receiptInvoiceDataFrom(data, { documentTypePolicy: this.documentTypePolicy });
  }

  salesReceipt(data: Record<string, unknown>): WrappedInvoiceData {
    return salesReceiptDataFrom(data, { documentTypePolicy: this.documentTypePolicy });
  }

  electronicReceipt(data: Record<string, unknown>): WrappedInvoiceData {
    return electronicReceiptDataFrom(data, { documentTypePolicy: this.documentTypePolicy });
  }

  creditNote(data: Record<string, unknown>): WrappedInvoiceData {
    return creditNoteDataFrom(data, { documentTypePolicy: this.documentTypePolicy });
  }

  debitNote(data: Record<string, unknown>): WrappedInvoiceData {
    return debitNoteDataFrom(data, { documentTypePolicy: this.documentTypePolicy });
  }

  transportDocument(data: Record<string, unknown>): WrappedInvoiceData {
    return transportDocumentDataFrom(data, { documentTypePolicy: this.documentTypePolicy });
  }

  returnNote(data: Record<string, unknown>): WrappedInvoiceData {
    return returnNoteDataFrom(data, { documentTypePolicy: this.documentTypePolicy });
  }

  entryNote(data: Record<string, unknown>): WrappedInvoiceData {
    return entryNoteDataFrom(data, { documentTypePolicy: this.documentTypePolicy });
  }

  generateDocumentId(): string {
    return this.config.generators.documentId();
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

  validateDfeXml(xml: string, documentType: DocumentType): Promise<XsdValidationResult> {
    return this.xsdValidator.validate(xml, {
      documentType,
      schemaVersion: DFE_XML_VERSION,
    });
  }

  signDfeXml(xml: string, options: XmlSigningOptions = {}): Promise<SignedXmlResult> {
    return this.xmlSigner.sign(xml, options);
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
    return this.dfaRenderer.render({
      iud: options.iud,
      qrCodeUrl: this.dfaQrCodeUrl(options.iud),
      title: options.title,
      issuerName: options.invoice?.emitter.name,
      customerName: options.invoice?.receiver?.name,
      total: options.invoice?.totals.grandTotal,
      currency: options.currency,
      emissionMode: options.emissionMode ?? 'Online',
    });
  }

  assertGoldenVector(kind: GoldenVectorKind, name: string, actual: string): Promise<void> {
    return assertGoldenVectorValue(this.goldenVectors, kind, name, actual);
  }

  configArray(): EfaturaConfigArray {
    return configAsArray(this.config);
  }
}
