import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'express/index': 'src/presentation/express/index.ts',
    'fastify/index': 'src/presentation/fastify/index.ts',
    'nest/index': 'src/presentation/nest/index.ts',
    'storage/knex/index': 'src/infrastructure/storage/knex/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: {
    entry: {
      index: 'src/index.ts',
      'express/index': 'src/presentation/express/index.ts',
      'fastify/index': 'src/presentation/fastify/index.ts',
      'nest/index': 'src/presentation/nest/index.ts',
      'storage/knex/index': 'src/infrastructure/storage/knex/index.ts',
    },
  },
  sourcemap: true,
  clean: true,
  target: 'node20',
});
