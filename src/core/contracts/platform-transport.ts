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
  errors: Array<{ code?: string; message: string; field?: string; raw?: unknown }>;
}

export interface PlatformTransport {
  submitDfeZip(input: PlatformSubmitInput): Promise<PlatformSubmissionResult>;
}
