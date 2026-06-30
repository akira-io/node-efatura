import { createHash } from 'node:crypto';
import { DOMParser } from '@xmldom/xmldom';
import { C14nCanonicalization, findAncestorNs } from 'xml-crypto';
import { EfaturaValidationError } from '../../domain/errors';

const XMLDSIG_NAMESPACE = 'http://www.w3.org/2000/09/xmldsig#';

type XmlDocument = ReturnType<DOMParser['parseFromString']>;
type XmlElement = NonNullable<XmlDocument['documentElement']>;
type AncestorNamespaces = ReturnType<typeof findAncestorNs>;

interface DigestReferenceOptions {
  removeSignatures?: boolean;
}

export function digestSignedReference(
  xml: string,
  referenceUri: string,
  options: DigestReferenceOptions = {},
): string {
  const document = parseXml(xml);
  const reference = findElementById(document, referenceId(referenceUri));
  const node = options.removeSignatures === true ? cloneWithoutSignatures(reference) : reference;

  return sha256Base64(canonicalizeNode(node, ancestorNamespaces(document, referenceUri)));
}

export function canonicalizeSignedInfo(xml: string): string {
  const document = parseXml(xml);
  const signedInfo = document.getElementsByTagName('ds:SignedInfo')[0];

  if (!signedInfo) {
    throw new EfaturaValidationError(
      'xml',
      'SignedInfo is required for XAdES-BES signing.',
      'signing.signed_info_required',
    );
  }

  return canonicalizeNode(signedInfo, findAncestorNs(document, "//*[local-name()='SignedInfo']"));
}

function parseXml(xml: string): XmlDocument {
  return new DOMParser().parseFromString(xml, 'application/xml');
}

function findElementById(document: XmlDocument, id: string): XmlElement {
  const elements = Array.from(document.getElementsByTagName('*')) as XmlElement[];
  const element = elements.find((candidate) => candidate.getAttribute('Id') === id);

  if (!element) {
    throw new EfaturaValidationError(
      'xml',
      `Signed XML reference ${id} was not found.`,
      'signing.reference_not_found',
    );
  }

  return element;
}

function referenceId(referenceUri: string): string {
  if (referenceUri.startsWith('#')) {
    return referenceUri.slice(1);
  }

  return referenceUri;
}

function cloneWithoutSignatures(element: XmlElement): XmlElement {
  const clone = element.cloneNode(true) as XmlElement;
  const signatures = (Array.from(clone.getElementsByTagName('*')) as XmlElement[]).filter(
    (node) => node.localName === 'Signature' && node.namespaceURI === XMLDSIG_NAMESPACE,
  );

  for (const signature of signatures) {
    signature.parentNode?.removeChild(signature);
  }

  return clone;
}

function ancestorNamespaces(document: XmlDocument, referenceUri: string): AncestorNamespaces {
  return findAncestorNs(document, `//*[@*[local-name(.)='Id']='${referenceId(referenceUri)}']`);
}

function canonicalizeNode(node: XmlElement, ancestorNamespaces: AncestorNamespaces): string {
  return String(new C14nCanonicalization().process(node, { ancestorNamespaces }));
}

function sha256Base64(value: string): string {
  return createHash('sha256').update(value).digest('base64');
}
