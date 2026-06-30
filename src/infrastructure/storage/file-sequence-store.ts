import { mkdir, open, readFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pid } from 'node:process';
import type { SequenceScope, SequenceStore } from '../../core/contracts';
import { sequenceScopeKey } from '../../core/contracts';

// Single-process only; multi-process deployments must use KnexSequenceStore.
export class FileSequenceStore implements SequenceStore {
  readonly #filePath: string;
  #queue: Promise<unknown> = Promise.resolve();

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  async next(scope: SequenceScope): Promise<number> {
    return this.#withLock(async () => {
      const data = await this.#read();
      const key = sequenceScopeKey(scope);
      const next = (data[key] ?? 0) + 1;

      data[key] = next;
      await this.#write(data);

      return next;
    });
  }

  async current(scope: SequenceScope): Promise<number | null> {
    return this.#withLock(async () => {
      const data = await this.#read();

      return data[sequenceScopeKey(scope)] ?? null;
    });
  }

  async reset(scope: SequenceScope): Promise<void> {
    await this.#withLock(async () => {
      const data = await this.#read();

      delete data[sequenceScopeKey(scope)];
      await this.#write(data);
    });
  }

  async #withLock<T>(callback: () => Promise<T>): Promise<T> {
    const run = this.#queue.then(callback, callback);

    this.#queue = run.catch(() => undefined);

    return run;
  }

  async #read(): Promise<Record<string, number>> {
    try {
      return JSON.parse(await readFile(this.#filePath, 'utf8')) as Record<string, number>;
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return {};
      }

      throw error;
    }
  }

  async #write(data: Record<string, number>): Promise<void> {
    const directory = dirname(this.#filePath);

    await mkdir(directory, { recursive: true });

    const temporaryPath = `${this.#filePath}.${pid}.tmp`;
    const handle = await open(temporaryPath, 'w');

    try {
      await handle.writeFile(JSON.stringify(data, null, 2));
      await handle.sync();
    } finally {
      await handle.close();
    }

    await rename(temporaryPath, this.#filePath);
    await syncDirectory(directory);
  }
}

async function syncDirectory(directory: string): Promise<void> {
  let handle: Awaited<ReturnType<typeof open>> | undefined;

  try {
    handle = await open(directory, 'r');
    await handle.sync();
  } catch {
    // Directory fsync is unsupported on some platforms; durability is best-effort there.
  } finally {
    await handle?.close();
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
