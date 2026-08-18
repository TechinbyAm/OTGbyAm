import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function getBuildScript() {
  try {
    const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
    return typeof packageJson.scripts?.build === 'string' ? packageJson.scripts.build : '';
  } catch {
    return '';
  }
}

const buildScript = getBuildScript();
// Published builds must use a deterministic bundler: OpenNext's output tracing
// is validated against a known bundler's build structure, so a plain
// `next build` (which would let Next.js pick) gets an explicit flag. Webpack is
// the long-standing default; the worker can switch a publish to Turbopack via
// the v2-publish-turbopack-enabled LD flag, which it forwards to this script as
// ANYTHING_PUBLISH_BUNDLER. Build scripts that already pin a bundler win.
const isPlainNextBuild =
  /\bnext\s+build\b/.test(buildScript) && !/\s--(?:webpack|turbopack)(?:\s|$)/.test(buildScript);
const forcedBundlerFlag =
  process.env.ANYTHING_PUBLISH_BUNDLER === 'turbopack' ? '--turbopack' : '--webpack';
const args = isPlainNextBuild ? ['build', forcedBundlerFlag] : ['build'];

const result = spawnSync('yarn', args, {
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

if (result.signal) {
  console.error(`Build command terminated by ${result.signal}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
