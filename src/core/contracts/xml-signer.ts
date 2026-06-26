export interface XmlSigningOptions {
  certificate?: string | Buffer;
  privateKey?: string | Buffer;
  keyId?: string;
  referenceUri?: string;
}

export interface SignedXmlResult {
  xml: string;
  algorithm: 'RSA-SHA256';
  profile: 'XAdES-BES';
  certificateFingerprint?: string;
}

export interface XmlSigner {
  sign(xml: string, options?: XmlSigningOptions): Promise<SignedXmlResult>;
}
