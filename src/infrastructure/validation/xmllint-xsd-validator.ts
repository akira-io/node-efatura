import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import type {
  XsdValidationContext,
  XsdValidationIssue,
  XsdValidationResult,
  XsdValidator,
} from '../../core/contracts';

const execFileAsync = promisify(execFile);
const DEFAULT_SCHEMA_RELATIVE_PATH = 'resources/xsd/efatura/2024-05-27/EnvelopedSignature.xsd';

export interface XmllintXsdValidatorOptions {
  schemaPath?: string;
  binaryPath?: string;
}

export class XmllintXsdValidator implements XsdValidator {
  readonly #schemaPath: string;
  readonly #binaryPath: string;

  constructor(options: XmllintXsdValidatorOptions = {}) {
    this.#schemaPath = options.schemaPath ?? resolveDefaultSchemaPath();
    this.#binaryPath = options.binaryPath ?? 'xmllint';
  }

  async validate(xml: string, context: XsdValidationContext): Promise<XsdValidationResult> {
    const directory = await mkdtemp(join(tmpdir(), 'efatura-xsd-'));
    const xmlPath = join(directory, `${context.documentType}-${context.schemaVersion}.xml`);

    try {
      await writeFile(xmlPath, xml, 'utf8');
      await execFileAsync(this.#binaryPath, ['--noout', '--schema', this.#schemaPath, xmlPath]);

      return { valid: true, errors: [] };
    } catch (error) {
      return {
        valid: false,
        errors: parseXmllintIssues(error),
      };
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  }
}

export function resolveDefaultSchemaPath(): string {
  const currentFilePath = currentModuleFilePath();
  const currentDirectory = currentFilePath ? dirname(currentFilePath) : null;
  const candidates = [
    join(process.cwd(), DEFAULT_SCHEMA_RELATIVE_PATH),
    ...(currentDirectory
      ? [
          join(currentDirectory, '../../../', DEFAULT_SCHEMA_RELATIVE_PATH),
          join(currentDirectory, '../', DEFAULT_SCHEMA_RELATIVE_PATH),
        ]
      : []),
  ];
  const schemaPath = candidates.find((candidate) => existsSync(candidate));

  if (!schemaPath) {
    return candidates[candidates.length - 1] ?? DEFAULT_SCHEMA_RELATIVE_PATH;
  }

  return schemaPath;
}

function currentModuleFilePath(): string | null {
  const stack = new Error().stack ?? '';

  for (const line of stack.split('\n')) {
    const match = /\(?((?:file:\/\/)?\/[^():]+):\d+:\d+\)?/.exec(line);
    const value = match?.[1];

    if (!value) {
      continue;
    }

    return value.startsWith('file://') ? fileURLToPath(value) : value;
  }

  return null;
}

function parseXmllintIssues(error: unknown): XsdValidationIssue[] {
  const stderr = errorOutput(error, 'stderr');
  const stdout = errorOutput(error, 'stdout');
  const output = `${stderr}\n${stdout}`.trim();
  const issues = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.endsWith(' fails to validate'))
    .map(parseIssueLine);

  return issues.length > 0 ? issues : [{ message: 'XSD validation failed.' }];
}

function parseIssueLine(line: string): XsdValidationIssue {
  const match = /^(?<path>.*?):(?<line>\d+):(?:(?<column>\d+):)?\s*(?<message>.*)$/.exec(line);

  if (!match?.groups) {
    return { message: line };
  }

  return {
    message: match.groups.message ?? line,
    path: match.groups.path,
    line: Number(match.groups.line),
    column: match.groups.column ? Number(match.groups.column) : undefined,
  };
}

function errorOutput(error: unknown, key: 'stderr' | 'stdout'): string {
  if (typeof error === 'object' && error !== null && key in error) {
    const value = (error as Record<string, unknown>)[key];

    return typeof value === 'string' ? value : '';
  }

  return '';
}
