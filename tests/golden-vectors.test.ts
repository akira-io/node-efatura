import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EfaturaValidationError } from '../src/domain/errors';
import { FileSystemGoldenVectorRepository } from '../src/infrastructure';

describe('file system golden vectors', () => {
  it('loads official vector fixtures and metadata from disk', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'efatura-golden-'));

    try {
      await mkdir(join(directory, 'xml'), { recursive: true });
      await writeFile(join(directory, 'xml', 'invoice.xml'), '<Dfe Id="CV"></Dfe>');
      await writeFile(
        join(directory, 'xml', 'invoice.meta.json'),
        JSON.stringify({ source: 'official-xsd-example' }),
      );

      const repository = new FileSystemGoldenVectorRepository(directory);

      await expect(repository.find('xml', 'invoice')).resolves.toMatchObject({
        kind: 'xml',
        name: 'invoice',
        expected: '<Dfe Id="CV"></Dfe>',
        metadata: { source: 'official-xsd-example' },
      });
      await expect(repository.all('xml')).resolves.toHaveLength(1);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('rejects vector names that escape the configured directory', async () => {
    const repository = new FileSystemGoldenVectorRepository(tmpdir());

    await expect(repository.find('xml', '../secret')).rejects.toBeInstanceOf(
      EfaturaValidationError,
    );
  });
});
