import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { parseArgs } from 'node:util';

const defaultPrismaOutputPath = join('prisma', 'schema', 'efatura-sequence.prisma');
const packagedPrismaSchemaPath = new URL(
  '../resources/prisma/efatura-sequence.prisma',
  import.meta.url,
).pathname;

export interface CliOptions {
  cwd?: string;
  output?: (line: string) => void;
  schemaPath?: string;
}

export async function runCli(argv: string[], options: CliOptions = {}): Promise<number> {
  const output = options.output ?? writeStdout;
  const [command, ...rest] = argv;

  if (command === 'prisma') {
    return copyPrismaSchema(rest, options, output);
  }

  if (command === undefined || command === 'help' || command === '--help' || command === '-h') {
    writeUsage(output);

    return 0;
  }

  output(`Unknown command: ${command}`);
  output('');
  writeUsage(output);

  return 1;
}

async function copyPrismaSchema(
  argv: string[],
  options: CliOptions,
  output: (line: string) => void,
): Promise<number> {
  const parsedArgs = parseArgs({
    allowPositionals: false,
    args: argv,
    options: {
      force: { type: 'boolean' },
      help: { short: 'h', type: 'boolean' },
      'models-only': { type: 'boolean' },
      out: { type: 'string' },
      print: { type: 'boolean' },
    },
  });

  if (parsedArgs.values.help === true) {
    writePrismaUsage(output);

    return 0;
  }

  let schema = await readFile(options.schemaPath ?? packagedPrismaSchemaPath, 'utf8');

  if (parsedArgs.values['models-only'] === true) {
    schema = schema
      .replace(/^(datasource|generator)\s+\w+\s*\{[^}]*\}\s*/gm, '')
      .replace(/^\n+/, '');
  }

  if (parsedArgs.values.print === true) {
    output(schema);

    return 0;
  }

  const relativeOutputPath =
    typeof parsedArgs.values.out === 'string' ? parsedArgs.values.out : defaultPrismaOutputPath;
  const destination = isAbsolute(relativeOutputPath)
    ? relativeOutputPath
    : join(options.cwd ?? process.cwd(), relativeOutputPath);

  if (parsedArgs.values.force !== true && (await exists(destination))) {
    output(`Refusing to overwrite ${destination}. Use --force to replace it.`);

    return 1;
  }

  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, schema, 'utf8');
  output(`Wrote ${destination}`);

  return 0;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);

    return true;
  } catch {
    return false;
  }
}

function writeUsage(output: (line: string) => void): void {
  output('Usage: efatura <command>');
  output('');
  output('Commands:');
  output('  prisma                 Copy the reference Prisma sequence model');
  output('                         [--out <path>] [--print] [--models-only] [--force]');
}

function writePrismaUsage(output: (line: string) => void): void {
  output('Usage: efatura prisma [--out <path>] [--print] [--models-only] [--force]');
  output('');
  output('Options:');
  output(`  --out <path>           Write to a custom path instead of ${defaultPrismaOutputPath}`);
  output('  --print                Print the schema instead of writing a file');
  output('  --models-only          Remove datasource and generator blocks before writing');
  output('  --force                Replace an existing output file');
}

function writeStdout(line: string): void {
  process.stdout.write(`${line}\n`);
}
