import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runCli } from '../../src/presentation/cli/run';

const schemaPath = join(process.cwd(), 'resources', 'prisma', 'efatura-sequence.prisma');
const temporaryDirectories: string[] = [];

async function makeTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'efatura-cli-'));
  temporaryDirectories.push(directory);

  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe('e-Fatura CLI', () => {
  it('copies the Prisma sequence model to the default schema folder', async () => {
    const cwd = await makeTemporaryDirectory();
    const output: string[] = [];

    const exitCode = await runCli(['prisma'], {
      cwd,
      output: (line) => output.push(line),
      schemaPath,
    });

    const destination = join(cwd, 'prisma', 'schema', 'efatura-sequence.prisma');
    await expect(readFile(destination, 'utf8')).resolves.toBe(await readFile(schemaPath, 'utf8'));
    expect(exitCode).toBe(0);
    expect(output).toEqual([`Wrote ${destination}`]);
  });

  it('refuses to overwrite the Prisma sequence model unless force is enabled', async () => {
    const cwd = await makeTemporaryDirectory();
    const destination = join(cwd, 'custom', 'sequence.prisma');
    const output: string[] = [];

    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, 'existing schema');

    const refusedCode = await runCli(['prisma', '--out', destination], {
      cwd,
      output: (line) => output.push(line),
      schemaPath,
    });
    const forcedCode = await runCli(['prisma', '--out', destination, '--force'], {
      cwd,
      output: (line) => output.push(line),
      schemaPath,
    });

    expect(refusedCode).toBe(1);
    expect(forcedCode).toBe(0);
    expect(output).toContain(`Refusing to overwrite ${destination}. Use --force to replace it.`);
    await expect(readFile(destination, 'utf8')).resolves.toBe(await readFile(schemaPath, 'utf8'));
  });

  it('prints the Prisma sequence model without writing files', async () => {
    const cwd = await makeTemporaryDirectory();
    const output: string[] = [];

    const exitCode = await runCli(['prisma', '--print'], {
      cwd,
      output: (line) => output.push(line),
      schemaPath,
    });

    await expect(
      readFile(join(cwd, 'prisma', 'schema', 'efatura-sequence.prisma'), 'utf8'),
    ).rejects.toThrow();
    expect(exitCode).toBe(0);
    expect(output).toEqual([await readFile(schemaPath, 'utf8')]);
  });

  it('prints only Prisma model blocks when models-only is enabled', async () => {
    const cwd = await makeTemporaryDirectory();
    const output: string[] = [];

    const exitCode = await runCli(['prisma', '--models-only', '--print'], {
      cwd,
      output: (line) => output.push(line),
      schemaPath,
    });

    expect(exitCode).toBe(0);
    expect(output.join('\n')).toContain('model EfaturaSequence');
    expect(output.join('\n')).not.toContain('datasource');
    expect(output.join('\n')).not.toContain('generator');
  });
});
