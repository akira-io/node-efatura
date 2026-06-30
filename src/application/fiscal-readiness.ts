import type { ResolvedEfaturaConfig } from '../config';
import type {
  EmitterAuthorizationClient,
  FiscalAuthorityIssue,
  SoftwareRegistryClient,
  TaxpayerLookupInput,
  TaxpayerRegistryClient,
} from '../core/contracts';
import type { InvoiceData } from '../domain/value-objects/invoice-data';
import type { FiscalReadinessOptions } from './efatura-options';

export type FiscalReadinessStatus = 'failed' | 'passed' | 'skipped';

export interface FiscalReadinessCheck {
  code: string;
  field?: string;
  status: FiscalReadinessStatus;
  message: string;
  details?: string;
  raw?: unknown;
}

export interface FiscalReadinessResult {
  ok: boolean;
  checks: FiscalReadinessCheck[];
}

export interface FiscalReadinessDependencies {
  taxpayerRegistryClient: TaxpayerRegistryClient;
  softwareRegistryClient: SoftwareRegistryClient;
  emitterAuthorizationClient: EmitterAuthorizationClient;
}

export async function validateFiscalReadiness(
  invoice: InvoiceData,
  config: ResolvedEfaturaConfig,
  dependencies: FiscalReadinessDependencies,
  options: FiscalReadinessOptions = {},
): Promise<FiscalReadinessResult> {
  if (!options.accessToken) {
    return result([
      skipped(
        'fiscal_authority.access_token_required',
        'Fiscal authority access token was not provided.',
      ),
    ]);
  }

  const context = {
    baseUrl: options.baseUrl ?? config.platformBaseUrl,
    accessToken: options.accessToken,
  };
  const taxpayerChecks = await taxpayerChecksFor(invoice, config, dependencies, context, options);
  const softwareCheck = await softwareCheckFor(
    dependencies.softwareRegistryClient,
    {
      code: config.softwareCode,
      name: config.softwareName,
      version: config.softwareVersion,
    },
    context,
  );
  const checks = [
    ...taxpayerChecks,
    softwareCheck,
    ...(await authorizationChecksFor(invoice, config, dependencies, context)),
  ];

  return result(checks);
}

async function taxpayerChecksFor(
  invoice: InvoiceData,
  config: ResolvedEfaturaConfig,
  dependencies: FiscalReadinessDependencies,
  context: { baseUrl: string; accessToken: string },
  options: FiscalReadinessOptions,
): Promise<FiscalReadinessCheck[]> {
  const taxpayers = taxpayersFor(invoice, config, options.validateReceiver !== false);
  return Promise.all(
    taxpayers.map(async (taxpayer) => {
      try {
        const taxpayerResult = await dependencies.taxpayerRegistryClient.lookupTaxpayer(
          taxpayer,
          context,
        );

        return taxpayerStatusCheck(taxpayer, taxpayerResult);
      } catch (error) {
        return failedCheck(
          `${taxpayer.role}.taxpayer_valid`,
          `${taxpayer.role} taxpayer could not be validated in the fiscal authority.`,
          error,
        );
      }
    }),
  );
}

async function softwareCheckFor(
  client: SoftwareRegistryClient,
  software: { code: string; name: string; version: string },
  context: { baseUrl: string; accessToken: string },
): Promise<FiscalReadinessCheck> {
  try {
    const softwareResult = await client.lookupSoftware(software, context);

    return statusCheck(
      softwareResult.registered,
      'software.registered',
      'Software is registered in the fiscal authority.',
      'Software is not registered in the fiscal authority.',
      softwareResult.issues,
      softwareResult.raw,
    );
  } catch (error) {
    return failedCheck(
      'software.registered',
      'Software could not be validated in the fiscal authority.',
      error,
    );
  }
}

function taxpayerStatusCheck(
  taxpayer: TaxpayerLookupInput,
  taxpayerResult: Awaited<ReturnType<TaxpayerRegistryClient['lookupTaxpayer']>>,
): FiscalReadinessCheck {
  return statusCheck(
    taxpayerResult.exists &&
      taxpayerResult.activityStarted !== false &&
      taxpayerResult.activityActive !== false &&
      taxpayerResult.hasFiscalFramework !== false,
    `${taxpayer.role}.taxpayer_valid`,
    `${taxpayer.role} taxpayer is valid in the fiscal authority.`,
    `${taxpayer.role} taxpayer is not valid in the fiscal authority.`,
    taxpayerResult.issues,
    taxpayerResult.raw,
  );
}

function failedCheck(code: string, message: string, error: unknown): FiscalReadinessCheck {
  return {
    code,
    details: errorMessage(error),
    message,
    status: 'failed',
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function authorizationChecksFor(
  invoice: InvoiceData,
  config: ResolvedEfaturaConfig,
  dependencies: FiscalReadinessDependencies,
  context: { baseUrl: string; accessToken: string },
): Promise<FiscalReadinessCheck[]> {
  const emitterNif =
    invoice.emitter.taxId?.countryCode === 'CV' ? invoice.emitter.taxId.value : null;

  if (!emitterNif || emitterNif === config.transmitterNif) {
    return [];
  }

  try {
    const authorization = await dependencies.emitterAuthorizationClient.checkEmitterAuthorization(
      {
        transmitterNif: config.transmitterNif,
        emitterNif,
        softwareCode: config.softwareCode,
      },
      context,
    );

    return [
      statusCheck(
        authorization.authorized,
        'emitter.authorization',
        'Emitter is authorized for this transmitter.',
        'Emitter is not authorized for this transmitter.',
        authorization.issues,
        authorization.raw,
      ),
    ];
  } catch (error) {
    return [
      failedCheck(
        'emitter.authorization',
        'Emitter authorization could not be validated in the fiscal authority.',
        error,
      ),
    ];
  }
}

function taxpayersFor(
  invoice: InvoiceData,
  config: ResolvedEfaturaConfig,
  validateReceiver: boolean,
): TaxpayerLookupInput[] {
  return [
    { role: 'transmitter', taxId: config.transmitterNif, issueDate: invoice.issueDate },
    ...taxpayerFromParty('emitter', invoice.emitter, invoice),
    ...(validateReceiver ? taxpayerFromParty('receiver', invoice.receiver, invoice) : []),
    ...taxpayerFromParty('paymentParty', invoice.paymentParty, invoice),
    ...taxpayerFromParty(
      'transportServiceProvider',
      invoice.transportServiceProviderParty,
      invoice,
    ),
  ];
}

function taxpayerFromParty(
  role: TaxpayerLookupInput['role'],
  party: InvoiceData['emitter'] | null,
  invoice: InvoiceData,
): TaxpayerLookupInput[] {
  if (party?.taxId?.countryCode !== 'CV') {
    return [];
  }

  return [
    {
      role,
      taxId: party.taxId.value,
      issueDate: invoice.issueDate,
      isolatedAct: invoice.isIsolatedAct,
    },
  ];
}

function statusCheck(
  passed: boolean,
  code: string,
  passedMessage: string,
  failedMessage: string,
  issues: FiscalAuthorityIssue[] = [],
  raw?: unknown,
): FiscalReadinessCheck {
  return {
    code,
    status: passed ? 'passed' : 'failed',
    message: passed ? passedMessage : (issues[0]?.message ?? failedMessage),
    field: issues[0]?.field,
    details: issues[0]?.details,
    raw,
  };
}

function skipped(code: string, message: string): FiscalReadinessCheck {
  return { code, message, status: 'skipped' };
}

function result(checks: FiscalReadinessCheck[]): FiscalReadinessResult {
  return {
    ok: checks.every((check) => check.status !== 'failed'),
    checks,
  };
}
