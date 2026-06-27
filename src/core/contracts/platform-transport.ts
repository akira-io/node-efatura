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
    raw?: unknown;
  }>;
  errors: Array<{ code?: string; message: string; field?: string; raw?: unknown }>;
}

export interface PlatformTransport {
  submitDfeZip(input: PlatformSubmitInput): Promise<PlatformSubmissionResult>;
}
