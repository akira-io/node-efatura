export interface FiscalAuthorityRequestContext {
  baseUrl: string;
  accessToken: string;
}

export interface FiscalAuthorityIssue {
  code?: string;
  field?: string;
  severity?: string;
  message: string;
  details?: string;
  raw?: unknown;
}

export interface TaxpayerLookupInput {
  taxId: string;
  role: 'emitter' | 'paymentParty' | 'receiver' | 'transmitter' | 'transportServiceProvider';
  issueDate?: string;
  isolatedAct?: boolean | null;
}

export interface TaxpayerLookupResult {
  exists: boolean;
  activityStarted?: boolean;
  activityActive?: boolean;
  hasFiscalFramework?: boolean;
  name?: string;
  issues?: FiscalAuthorityIssue[];
  raw?: unknown;
}

export interface SoftwareLookupInput {
  code: string;
  name?: string;
  version?: string;
}

export interface SoftwareLookupResult {
  registered: boolean;
  issues?: FiscalAuthorityIssue[];
  raw?: unknown;
}

export interface EmitterAuthorizationInput {
  transmitterNif: string;
  emitterNif: string;
  softwareCode: string;
}

export interface EmitterAuthorizationResult {
  authorized: boolean;
  issues?: FiscalAuthorityIssue[];
  raw?: unknown;
}

export interface TaxpayerRegistryClient {
  lookupTaxpayer(
    input: TaxpayerLookupInput,
    context: FiscalAuthorityRequestContext,
  ): Promise<TaxpayerLookupResult>;
}

export interface SoftwareRegistryClient {
  lookupSoftware(
    input: SoftwareLookupInput,
    context: FiscalAuthorityRequestContext,
  ): Promise<SoftwareLookupResult>;
}

export interface EmitterAuthorizationClient {
  checkEmitterAuthorization(
    input: EmitterAuthorizationInput,
    context: FiscalAuthorityRequestContext,
  ): Promise<EmitterAuthorizationResult>;
}
