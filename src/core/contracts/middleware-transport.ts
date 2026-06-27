export interface MiddlewareSubmitInput {
  zip: Buffer;
  baseUrl: string;
  transmitterKey: string;
}

export interface MiddlewareDocumentResult {
  iud?: string;
  status?: string;
  code?: string;
  message?: string;
  repositoryCode?: string;
  authorizationCode?: string;
  validationCode?: string;
  processedAt?: string;
  raw?: unknown;
}

export interface MiddlewareSubmissionError {
  code?: string;
  message: string;
  field?: string;
  severity?: string;
  details?: string;
  raw?: unknown;
}

export interface MiddlewareSubmissionResult {
  ok: boolean;
  status: number;
  statusText: string;
  rawBody: string;
  body: unknown;
  requestId?: string;
  correlationId?: string;
  receivedAt?: string;
  documents: MiddlewareDocumentResult[];
  errors: MiddlewareSubmissionError[];
}

export interface MiddlewareTransport {
  submitDfeZip(input: MiddlewareSubmitInput): Promise<MiddlewareSubmissionResult>;
}
