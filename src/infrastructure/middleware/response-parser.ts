import { DOMParser } from '@xmldom/xmldom';
import type {
  MiddlewareDocumentResult,
  MiddlewareSubmissionError,
  MiddlewareSubmissionResult,
  PlatformSubmissionResult,
} from '../../core/contracts';
import {
  CORRELATION_ID_KEYS,
  DOCUMENT_AUTHORIZATION_KEYS,
  DOCUMENT_CODE_KEYS,
  DOCUMENT_CONTAINER_KEYS,
  DOCUMENT_ID_KEYS,
  DOCUMENT_PROCESSED_AT_KEYS,
  DOCUMENT_REPOSITORY_KEYS,
  DOCUMENT_STATUS_KEYS,
  DOCUMENT_VALIDATION_KEYS,
  ERROR_CODE_KEYS,
  ERROR_CONTAINER_KEYS,
  ERROR_DETAIL_KEYS,
  ERROR_FIELD_KEYS,
  ERROR_SEVERITY_KEYS,
  MESSAGE_KEYS,
  RECEIVED_AT_KEYS,
  REQUEST_ID_KEYS,
} from './response-parser-keys';

type SubmissionInput = Pick<
  MiddlewareSubmissionResult,
  'body' | 'ok' | 'rawBody' | 'status' | 'statusText'
>;

interface XmlNode {
  nodeName: string;
  nodeType: number;
  nodeValue: string | null;
  childNodes: {
    length: number;
    item(index: number): XmlNode | null;
  };
  attributes: {
    length: number;
    item(index: number): { name: string; value: string } | null;
  };
}

export function parseServiceBody(body: string, contentType = ''): unknown {
  const trimmed = body.trim();

  if (trimmed === '') {
    return null;
  }

  if (contentType.includes('json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return body;
    }
  }

  if (contentType.includes('xml') || trimmed.startsWith('<')) {
    return parseXmlBody(trimmed);
  }

  return body;
}

export function normalizeSubmissionResult(input: SubmissionInput): MiddlewareSubmissionResult {
  return {
    ...input,
    ...extractMetadata(input.body),
    documents: extractDocuments(input.body),
    errors: extractErrors(input),
  };
}

export function normalizePlatformSubmissionResult(
  input: SubmissionInput,
): PlatformSubmissionResult {
  return {
    ...input,
    ...extractMetadata(input.body),
    documents: extractDocuments(input.body),
    errors: extractErrors(input),
  };
}

function extractDocuments(body: unknown): MiddlewareDocumentResult[] {
  const candidates = findValues(body, DOCUMENT_CONTAINER_KEYS);

  return candidates
    .flatMap((candidate) => (Array.isArray(candidate) ? candidate : [candidate]))
    .filter(isRecord)
    .map((item) => ({
      iud: text(valueByKeys(item, DOCUMENT_ID_KEYS)),
      status: text(valueByKeys(item, DOCUMENT_STATUS_KEYS)),
      code: text(valueByKeys(item, DOCUMENT_CODE_KEYS)),
      message: text(valueByKeys(item, MESSAGE_KEYS)),
      repositoryCode: text(valueByKeys(item, DOCUMENT_REPOSITORY_KEYS)),
      authorizationCode: text(valueByKeys(item, DOCUMENT_AUTHORIZATION_KEYS)),
      validationCode: text(valueByKeys(item, DOCUMENT_VALIDATION_KEYS)),
      processedAt: text(valueByKeys(item, DOCUMENT_PROCESSED_AT_KEYS)),
      raw: item,
    }));
}

function extractErrors(input: SubmissionInput): MiddlewareSubmissionError[] {
  const candidates = findValues(input.body, ERROR_CONTAINER_KEYS);
  const errors = candidates
    .flatMap((candidate) => (Array.isArray(candidate) ? candidate : [candidate]))
    .map(errorFromValue);

  if (errors.length > 0 || input.ok) {
    return errors;
  }

  return [{ code: String(input.status), message: input.statusText || 'Submission failed.' }];
}

function errorFromValue(item: unknown): MiddlewareSubmissionError {
  if (!isRecord(item)) {
    return { message: String(item), raw: item };
  }

  return {
    code: text(valueByKeys(item, ERROR_CODE_KEYS)),
    message: text(valueByKeys(item, [...MESSAGE_KEYS, 'detail', 'Detail'])) ?? 'Submission failed.',
    field: text(valueByKeys(item, ERROR_FIELD_KEYS)),
    severity: text(valueByKeys(item, ERROR_SEVERITY_KEYS)),
    details: text(valueByKeys(item, ERROR_DETAIL_KEYS)),
    raw: item,
  };
}

function parseXmlBody(xml: string): unknown {
  const root = new DOMParser().parseFromString(xml, 'application/xml').documentElement as XmlNode;

  return root ? { [xmlName(root.nodeName)]: nodeValue(root) } : xml;
}

function nodeValue(node: XmlNode): unknown {
  const children = elementChildren(node);
  const attributes = attributesOf(node);
  const content = directText(node);

  if (children.length === 0) {
    return Object.keys(attributes).length > 0 ? { ...attributes, value: content } : content;
  }

  return children.reduce<Record<string, unknown>>(
    (record, child) => {
      const value = nodeValue(child);
      const childName = xmlName(child.nodeName);
      const current = record[childName];

      record[childName] = current === undefined ? value : arrayOf(current).concat(value);

      return record;
    },
    { ...attributes },
  );
}

function elementChildren(node: XmlNode): XmlNode[] {
  const children: XmlNode[] = [];

  for (let index = 0; index < node.childNodes.length; index += 1) {
    const child = node.childNodes.item(index);

    if (child?.nodeType === 1) {
      children.push(child);
    }
  }

  return children;
}

function attributesOf(node: XmlNode): Record<string, string> {
  const attributes: Record<string, string> = {};

  for (let index = 0; index < node.attributes.length; index += 1) {
    const attribute = node.attributes.item(index);

    if (attribute) {
      attributes[attribute.name] = attribute.value;
    }
  }

  return attributes;
}

function directText(node: XmlNode): string {
  let content = '';

  for (let index = 0; index < node.childNodes.length; index += 1) {
    const child = node.childNodes.item(index);

    if (child?.nodeType === 3 || child?.nodeType === 4) {
      content += child.nodeValue ?? '';
    }
  }

  return content.trim();
}

function findValues(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => findValues(item, keys));
  }

  if (!isRecord(value)) {
    return [];
  }

  return [
    ...keys.flatMap((key) => (value[key] === undefined ? [] : [value[key]])),
    ...Object.values(value).flatMap((child) => findValues(child, keys)),
  ];
}

function extractMetadata(
  body: unknown,
): Pick<MiddlewareSubmissionResult, 'correlationId' | 'receivedAt' | 'requestId'> {
  return {
    requestId: firstText(body, REQUEST_ID_KEYS),
    correlationId: firstText(body, CORRELATION_ID_KEYS),
    receivedAt: firstText(body, RECEIVED_AT_KEYS),
  };
}

function firstText(value: unknown, keys: string[]): string | undefined {
  for (const candidate of findValues(value, keys)) {
    const result = text(candidate);

    if (result) {
      return result;
    }
  }

  return undefined;
}

function valueByKeys(record: Record<string, unknown>, keys: string[]): unknown {
  const key = keys.find((candidate) => record[candidate] !== undefined);

  return key ? record[key] : undefined;
}

function arrayOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return undefined;
}

function xmlName(name: string): string {
  return name.includes(':') ? (name.split(':').at(-1) ?? name) : name;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
