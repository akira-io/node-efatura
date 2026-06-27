import { DOMParser } from '@xmldom/xmldom';
import type {
  MiddlewareDocumentResult,
  MiddlewareSubmissionError,
  MiddlewareSubmissionResult,
  PlatformSubmissionResult,
} from '../../core/contracts';

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
    documents: extractDocuments(input.body),
    errors: extractErrors(input),
  };
}

export function normalizePlatformSubmissionResult(
  input: SubmissionInput,
): PlatformSubmissionResult {
  return {
    ...input,
    documents: extractDocuments(input.body),
    errors: extractErrors(input),
  };
}

function extractDocuments(body: unknown): MiddlewareDocumentResult[] {
  const candidates = findValues(body, ['documents', 'Documents', 'dfe', 'Dfe', 'dfes', 'results']);

  return candidates
    .flatMap((candidate) => (Array.isArray(candidate) ? candidate : [candidate]))
    .filter(isRecord)
    .map((item) => ({
      iud: text(valueByKeys(item, ['iud', 'IUD', 'id', 'Id'])),
      status: text(valueByKeys(item, ['status', 'Status', 'state', 'State'])),
      code: text(valueByKeys(item, ['code', 'Code', 'statusCode', 'StatusCode'])),
      message: text(valueByKeys(item, ['message', 'Message', 'description', 'Description'])),
      repositoryCode: text(valueByKeys(item, ['repositoryCode', 'RepositoryCode'])),
      raw: item,
    }));
}

function extractErrors(input: SubmissionInput): MiddlewareSubmissionError[] {
  const candidates = findValues(input.body, [
    'errors',
    'Errors',
    'error',
    'Error',
    'validationErrors',
    'ValidationErrors',
    'messages',
    'Messages',
  ]);
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
    code: text(valueByKeys(item, ['code', 'Code', 'errorCode', 'ErrorCode', 'statusCode'])),
    message:
      text(valueByKeys(item, ['message', 'Message', 'description', 'Description', 'detail'])) ??
      'Submission failed.',
    field: text(valueByKeys(item, ['field', 'Field', 'path', 'Path', 'property'])),
    raw: item,
  };
}

function parseXmlBody(xml: string): unknown {
  const root = new DOMParser().parseFromString(xml, 'application/xml').documentElement as XmlNode;

  return root ? { [root.nodeName]: nodeValue(root) } : xml;
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
      const current = record[child.nodeName];

      record[child.nodeName] = current === undefined ? value : arrayOf(current).concat(value);

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
