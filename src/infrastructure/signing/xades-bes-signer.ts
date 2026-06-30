import { createHash, createSign, X509Certificate } from 'node:crypto';
import { DOMParser } from '@xmldom/xmldom';
import { escapeAttribute, escapeXml } from '../../application/xml/dfe-xml-fragments';
import type { SignedXmlResult, XmlSigner, XmlSigningOptions } from '../../core/contracts';
import { EfaturaValidationError } from '../../domain/errors';
import { canonicalizeSignedInfo, digestSignedReference } from './xml-dsig-references';

const C14N_ALGORITHM = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const DIGEST_ALGORITHM = 'http://www.w3.org/2001/04/xmlenc#sha256';
const SIGNATURE_ALGORITHM = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const ENVELOPED_SIGNATURE_ALGORITHM = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';
const XADES_NAMESPACE = 'http://uri.etsi.org/01903/v1.3.2#';
const SIGNED_PROPERTIES_TYPE = 'http://uri.etsi.org/01903#SignedProperties';

interface SignatureIds {
  signatureId: string;
  dataReferenceId: string;
  signedPropertiesId: string;
}

export class XadesBesSigner implements XmlSigner {
  async sign(xml: string, options: XmlSigningOptions = {}): Promise<SignedXmlResult> {
    const certificate = certificateFrom(options.certificate);
    const privateKey = requiredPrivateKey(options.privateKey);
    const root = rootInfo(xml);
    const ids = signatureIds(options);
    const referenceUri = options.referenceUri ?? `#${root.id}`;
    const signedProperties = signedPropertiesXml(
      certificate,
      ids,
      signingTime(options.signingTime),
    );
    const referenceSignatureXml = fullSignatureXml(ids, '', '', certificate, signedProperties);
    const referenceDocumentXml = insertSignature(xml, root.name, referenceSignatureXml);
    const dataDigest = digestSignedReference(referenceDocumentXml, referenceUri, {
      removeSignatures: true,
    });
    const signedPropertiesDigest = digestSignedReference(
      referenceDocumentXml,
      `#${ids.signedPropertiesId}`,
    );
    const signedInfo = signedInfoXml(ids, referenceUri, dataDigest, signedPropertiesDigest);
    const unsignedSignatureXml = fullSignatureXml(
      ids,
      signedInfo,
      '',
      certificate,
      signedProperties,
    );
    const canonicalSignedInfo = canonicalizeSignedInfo(
      insertSignature(xml, root.name, unsignedSignatureXml),
    );
    const signatureValue = signCanonicalXml(canonicalSignedInfo, privateKey);
    const signatureXml = fullSignatureXml(
      ids,
      signedInfo,
      signatureValue,
      certificate,
      signedProperties,
    );

    return {
      xml: insertSignature(xml, root.name, signatureXml),
      algorithm: 'RSA-SHA256',
      profile: 'XAdES-BES',
      certificateFingerprint: certificate.fingerprint256,
    };
  }
}

function certificateFrom(value: XmlSigningOptions['certificate']): X509Certificate {
  if (!value) {
    throw new EfaturaValidationError(
      'certificate',
      'Certificate is required for XAdES-BES signing.',
      'signing.certificate_required',
    );
  }

  return new X509Certificate(value);
}

function requiredPrivateKey(value: XmlSigningOptions['privateKey']): string | Buffer {
  if (!value) {
    throw new EfaturaValidationError(
      'privateKey',
      'Private key is required for XAdES-BES signing.',
      'signing.private_key_required',
    );
  }

  return value;
}

function rootInfo(xml: string): { id: string; name: string } {
  const root = new DOMParser().parseFromString(xml, 'application/xml').documentElement;
  const id = root?.getAttribute('Id');

  if (!root || !id) {
    throw new EfaturaValidationError(
      'xml',
      'DFE XML root Id is required.',
      'signing.root_id_required',
    );
  }

  return { id, name: root.nodeName };
}

function signatureIds(options: XmlSigningOptions): SignatureIds {
  return {
    signatureId: options.signatureId ?? options.keyId ?? 'EmitterPartySignatureId',
    dataReferenceId: options.dataReferenceId ?? 'DataReferenceId',
    signedPropertiesId: options.signedPropertiesId ?? 'SignedPropertiesId',
  };
}

function signedInfoXml(
  ids: SignatureIds,
  referenceUri: string,
  dataDigest: string,
  signedPropertiesDigest: string,
): string {
  return `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:CanonicalizationMethod Algorithm="${C14N_ALGORITHM}"/><ds:SignatureMethod Algorithm="${SIGNATURE_ALGORITHM}"/><ds:Reference Id="${escapeAttribute(
    ids.dataReferenceId,
  )}" URI="${escapeAttribute(referenceUri)}"><ds:Transforms><ds:Transform Algorithm="${ENVELOPED_SIGNATURE_ALGORITHM}"/><ds:Transform Algorithm="${C14N_ALGORITHM}"/></ds:Transforms><ds:DigestMethod Algorithm="${DIGEST_ALGORITHM}"/><ds:DigestValue>${dataDigest}</ds:DigestValue></ds:Reference><ds:Reference URI="#${escapeAttribute(
    ids.signedPropertiesId,
  )}" Type="${SIGNED_PROPERTIES_TYPE}"><ds:Transforms><ds:Transform Algorithm="${C14N_ALGORITHM}"/></ds:Transforms><ds:DigestMethod Algorithm="${DIGEST_ALGORITHM}"/><ds:DigestValue>${signedPropertiesDigest}</ds:DigestValue></ds:Reference></ds:SignedInfo>`;
}

function signedPropertiesXml(
  certificate: X509Certificate,
  ids: SignatureIds,
  signedAt: string,
): string {
  return `<xades:SignedProperties xmlns:xades="${XADES_NAMESPACE}" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="${escapeAttribute(
    ids.signedPropertiesId,
  )}"><xades:SignedSignatureProperties><xades:SigningTime>${escapeXml(
    signedAt,
  )}</xades:SigningTime><xades:SigningCertificate><xades:Cert><xades:CertDigest><ds:DigestMethod Algorithm="${DIGEST_ALGORITHM}"/><ds:DigestValue>${sha256Base64(
    certificate.raw,
  )}</ds:DigestValue></xades:CertDigest><xades:IssuerSerial><ds:X509IssuerName>${escapeXml(
    certificate.issuer,
  )}</ds:X509IssuerName><ds:X509SerialNumber>${certificateSerialNumber(
    certificate,
  )}</ds:X509SerialNumber></xades:IssuerSerial></xades:Cert></xades:SigningCertificate></xades:SignedSignatureProperties><xades:SignedDataObjectProperties><xades:DataObjectFormat ObjectReference="#${escapeAttribute(
    ids.dataReferenceId,
  )}"><xades:MimeType>text/xml</xades:MimeType></xades:DataObjectFormat></xades:SignedDataObjectProperties></xades:SignedProperties>`;
}

function fullSignatureXml(
  ids: SignatureIds,
  signedInfo: string,
  signatureValue: string,
  certificate: X509Certificate,
  signedProperties: string,
): string {
  return `<ds:Signature Id="${escapeAttribute(
    ids.signatureId,
  )}" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<ds:SignatureValue>${signatureValue}</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>${certificate.raw.toString(
    'base64',
  )}</ds:X509Certificate></ds:X509Data></ds:KeyInfo><ds:Object><xades:QualifyingProperties xmlns:xades="${XADES_NAMESPACE}" Target="#${escapeAttribute(
    ids.signatureId,
  )}">${signedProperties}</xades:QualifyingProperties></ds:Object></ds:Signature>`;
}

function sha256Base64(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('base64');
}

function signCanonicalXml(value: string, privateKey: string | Buffer): string {
  const signer = createSign('RSA-SHA256');

  signer.update(value);
  signer.end();

  return signer.sign(privateKey, 'base64');
}

function signingTime(value: XmlSigningOptions['signingTime']): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value ?? new Date().toISOString();
}

function certificateSerialNumber(certificate: X509Certificate): string {
  return BigInt(`0x${certificate.serialNumber.replaceAll(':', '')}`).toString(10);
}

function insertSignature(xml: string, rootName: string, signatureXml: string): string {
  const closingTag = `</${rootName}>`;
  const index = xml.lastIndexOf(closingTag);

  if (index === -1) {
    throw new EfaturaValidationError(
      'xml',
      'DFE XML closing tag is required.',
      'signing.root_close_required',
    );
  }

  return `${xml.slice(0, index)}${signatureXml}${xml.slice(index)}`;
}
