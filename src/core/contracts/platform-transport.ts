export interface PlatformSubmitInput {
  zip: Buffer;
  baseUrl: string;
  accessToken: string;
  repositoryCode: number;
}

export interface PlatformSubmissionResult {
  ok: boolean;
  status: number;
  statusText: string;
  rawBody: string;
  body: unknown;
  documents: Array<{
    iud?: string;
    status?: string;
    code?: string;
    message?: string;
    repositoryCode?: string;
    authorizationCode?: string;
    validationCode?: string;
    processedAt?: string;
    raw?: unknown;
  }>;
  requestId?: string;
  correlationId?: string;
  receivedAt?: string;
  errors: Array<{
    code?: string;
    message: string;
    field?: string;
    severity?: string;
    details?: string;
    raw?: unknown;
  }>;
}

export interface PlatformTransport {
  submitDfeZip(input: PlatformSubmitInput): Promise<PlatformSubmissionResult>;
}
