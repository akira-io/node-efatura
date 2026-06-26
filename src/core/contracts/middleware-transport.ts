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
  raw?: unknown;
}

export interface MiddlewareSubmissionError {
  code?: string;
  message: string;
  field?: string;
  raw?: unknown;
}

export interface MiddlewareSubmissionResult {
  ok: boolean;
  status: number;
  statusText: string;
  rawBody: string;
  body: unknown;
  documents: MiddlewareDocumentResult[];
  errors: MiddlewareSubmissionError[];
}

export interface MiddlewareTransport {
  submitDfeZip(input: MiddlewareSubmitInput): Promise<MiddlewareSubmissionResult>;
}
