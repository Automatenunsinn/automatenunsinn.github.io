module.exports = {
  // Detect per-file whether it is an ESM module or a CommonJS script, so the
  // core-js polyfills injected by useBuiltIns are added with the matching
  // import/require form. Needed because we also transpile crc's CJS files.
  sourceType: 'unambiguous',
  presets: [
    [
      '@babel/preset-env',
      {
        // Targets are read from .browserslistrc (iOS >= 9), so syntax is
        // lowered all the way to ES5 — esbuild cannot do this.
        useBuiltIns: 'usage',
        corejs: '3.49',
      },
    ],
    '@babel/preset-typescript',
  ],
};
