export interface CertificateValidationInput {
  certificate: string | Buffer;
  privateKey?: string | Buffer;
  caCertificates?: Array<string | Buffer>;
  at?: Date | string;
}

export interface CertificateValidationIssue {
  code: string;
  message: string;
  raw?: string;
}

export interface CertificateValidationResult {
  valid: boolean;
  subject?: string;
  issuer?: string;
  serialNumber?: string;
  fingerprint256?: string;
  validFrom?: string;
  validTo?: string;
  issues: CertificateValidationIssue[];
}

export interface CertificateValidator {
  validate(input: CertificateValidationInput): Promise<CertificateValidationResult>;
}
