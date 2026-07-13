import { build } from 'esbuild';

await build({
  entryPoints: ['action/src/index.ts'],
  outfile: 'action/dist/index.cjs',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  legalComments: 'inline',
  sourcemap: false,
});
