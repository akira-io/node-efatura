import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import type { GoldenVector, GoldenVectorKind, GoldenVectorRepository } from '../../core/contracts';
import { EfaturaValidationError } from '../../domain/errors';

const VECTOR_KINDS: GoldenVectorKind[] = ['iud', 'xml', 'zip', 'signature'];
const VECTOR_EXTENSIONS = ['.zip.b64', '.base64', '.b64', '.txt', '.xml', '.json', '.sig', ''];
const METADATA_EXTENSION = '.meta.json';

export class FileSystemGoldenVectorRepository implements GoldenVectorRepository {
  readonly #rootDirectory: string;

  constructor(rootDirectory: string) {
    this.#rootDirectory = resolve(rootDirectory);
  }

  async find(kind: GoldenVectorKind, name: string): Promise<GoldenVector | null> {
    const vectorPath = await this.#findVectorPath(kind, validVectorName(name));

    if (!vectorPath) {
      return null;
    }

    return {
      kind,
      name,
      expected: await readFile(vectorPath, 'utf8'),
      metadata: await readMetadata(vectorPath),
    };
  }

  async all(kind?: GoldenVectorKind): Promise<GoldenVector[]> {
    const kinds = kind ? [kind] : VECTOR_KINDS;
    const vectors = await Promise.all(kinds.map((currentKind) => this.#allForKind(currentKind)));

    return vectors.flat();
  }

  async #allForKind(kind: GoldenVectorKind): Promise<GoldenVector[]> {
    const kindDirectory = this.#pathFor(kind);
    const entries = await directoryEntries(kindDirectory);
    const vectors = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && !entry.name.endsWith(METADATA_EXTENSION))
        .map(async (entry) => {
          const vectorPath = join(kindDirectory, entry.name);

          return {
            kind,
            name: vectorNameFromFile(entry.name),
            expected: await readFile(vectorPath, 'utf8'),
            metadata: await readMetadata(vectorPath),
          };
        }),
    );

    return vectors;
  }

  async #findVectorPath(kind: GoldenVectorKind, name: string): Promise<string | null> {
    for (const extension of VECTOR_EXTENSIONS) {
      const vectorPath = this.#pathFor(kind, `${name}${extension}`);

      if (await isFile(vectorPath)) {
        return vectorPath;
      }
    }

    return null;
  }

  #pathFor(kind: GoldenVectorKind, fileName = ''): string {
    const fullPath = resolve(this.#rootDirectory, kind, fileName);
    const rootPrefix = `${this.#rootDirectory}${sep}`;

    if (fullPath !== this.#rootDirectory && !fullPath.startsWith(rootPrefix)) {
      throw new EfaturaValidationError(
        'goldenVectors.path',
        'Golden vector path must stay inside the configured directory.',
        'golden_vector.path_invalid',
      );
    }

    return fullPath;
  }
}

async function directoryEntries(directory: string) {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isNotFound(error)) {
      return [];
    }

    throw error;
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch (error) {
    if (isNotFound(error)) {
      return false;
    }

    throw error;
  }
}

async function readMetadata(vectorPath: string): Promise<Record<string, unknown> | undefined> {
  const candidates = [
    `${vectorPath}${METADATA_EXTENSION}`,
    `${stripVectorExtension(vectorPath)}${METADATA_EXTENSION}`,
  ];

  for (const candidate of candidates) {
    if (await isFile(candidate)) {
      const metadata = JSON.parse(await readFile(candidate, 'utf8')) as unknown;

      return isRecord(metadata) ? metadata : undefined;
    }
  }

  return undefined;
}

function validVectorName(name: string): string {
  if (name === '' || name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
    throw new EfaturaValidationError(
      'goldenVectors.name',
      'Golden vector name is invalid.',
      'golden_vector.name_invalid',
    );
  }

  return name;
}

function vectorNameFromFile(fileName: string): string {
  return stripVectorExtension(basename(fileName));
}

function stripVectorExtension(value: string): string {
  const extension = VECTOR_EXTENSIONS.find(
    (candidate) => candidate !== '' && value.endsWith(candidate),
  );

  return extension ? value.slice(0, -extension.length) : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNotFound(error: unknown): boolean {
  return isRecord(error) && error.code === 'ENOENT';
}
