const esbuild = require('esbuild');
const path = require('node:path');
const sass = require('sass');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, '_site');
const crcEntry = path.join(root, 'node_modules/crc/cjs-default-unwrap/index.js');
const vendorEntries = {
  crc: crcEntry,
  'crypto-core': require.resolve('crypto-js/core'),
  'crypto-md5': require.resolve('crypto-js/md5'),
  events: require.resolve('events/'),
  'intel-hex': require.resolve('intel-hex'),
  jquery: require.resolve('jquery'),
  papaparse: require.resolve('papaparse'),
  stk500: require.resolve('stk500'),
  'stk500-statics': require.resolve('stk500/lib/statics'),
  buffer: require.resolve('buffer/')
};

for (const entry of Object.keys(vendorEntries)) {
  const outputPath = path.join(outputDir, 'vendor', `${entry}.js`);
  const result = esbuild.buildSync({
    entryPoints: [vendorEntries[entry]],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    outfile: outputPath,
    alias: {
      stream: require.resolve('stream-browserify')
    },
    logLevel: 'silent'
  });
  if (result.errors.length) throw new Error(`Failed to build vendor entry ${entry}`);
}

execFileSync(path.join(root, 'node_modules/.bin/tsc'), [
  '--project', path.join(root, 'tsconfig.json'),
  '--noCheck',
  '--outDir', outputDir,
  '--target', 'ES2022',
  '--module', 'ES2022',
  '--moduleResolution', 'bundler',
  '--sourceMap', 'false'
], { stdio: 'inherit' });

for (const stylesheet of ['style', 'db', 'bw']) {
  const result = sass.compile(path.join(root, `src/${stylesheet}.scss`), {
    loadPaths: [path.join(root, 'node_modules')],
    style: 'expanded'
  });
  fs.writeFileSync(path.join(outputDir, `${stylesheet}.css`), result.css);
}
