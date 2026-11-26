const esbuild = require('esbuild');
const path = require('node:path');

const sourcePath = path.resolve(__dirname, '../src/utils/teileTable.ts');
const result = esbuild.buildSync({
  entryPoints: [sourcePath],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
  logLevel: 'silent'
});
const loadedModule = { exports: {} };
new Function('module', 'exports', 'require', result.outputFiles[0].text)(
  loadedModule,
  loadedModule.exports,
  require
);

module.exports = loadedModule.exports;
