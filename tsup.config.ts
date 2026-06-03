import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/drivers/tanstack.ts',
    'src/drivers/react-router.ts',
    'src/react/index.tsx',
    'src/cli.ts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  external: ['@tanstack/react-router', 'react-router-dom', 'react'],
});
