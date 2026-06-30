import { defineConfig } from 'tsup';

const packageEntries = {
  index: 'src/index.ts',
  'express/index': 'src/presentation/express/index.ts',
  'fastify/index': 'src/presentation/fastify/index.ts',
  'nest/index': 'src/presentation/nest/index.ts',
  'storage/knex/index': 'src/infrastructure/storage/knex/index.ts',
  'storage/prisma/index': 'src/infrastructure/storage/prisma/index.ts',
};

export default defineConfig([
  {
    entry: packageEntries,
    format: ['esm', 'cjs'],
    dts: {
      entry: packageEntries,
    },
    sourcemap: true,
    clean: true,
    target: 'node20',
  },
  {
    entry: {
      cli: 'src/presentation/cli/cli.ts',
    },
    format: ['esm'],
    sourcemap: true,
    clean: false,
    target: 'node20',
  },
]);
