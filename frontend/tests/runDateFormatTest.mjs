import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const temporaryOutputDirectory = '.tmp-test';
const tscPath = fileURLToPath(new URL('../node_modules/typescript/lib/tsc.js', import.meta.url));

try {
  execFileSync(process.execPath, [
    tscPath,
    '--target',
    'ES2022',
    '--module',
    'ES2022',
    '--moduleResolution',
    'Bundler',
    '--outDir',
    temporaryOutputDirectory,
    '--noEmit',
    'false',
    'src/dateFormat.ts',
    'src/apiConfig.ts'
  ], { stdio: 'inherit' });
  execFileSync(process.execPath, ['--test', 'tests/dateFormat.test.mjs'], { stdio: 'inherit' });
  execFileSync(process.execPath, ['--test', 'tests/apiConfig.test.mjs'], { stdio: 'inherit' });
} finally {
  rmSync(temporaryOutputDirectory, { recursive: true, force: true });
}
