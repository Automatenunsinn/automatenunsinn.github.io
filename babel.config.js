module.exports = {
  // Detect per-file whether it is an ESM module or a CommonJS script, so the
  // core-js polyfills injected by useBuiltIns are added with the matching
  // import/require form. Needed because we also transpile crc's CJS files.
  sourceType: 'unambiguous',
  overrides: [
    {
      // App code: strip TS types, lower syntax, and inject core-js polyfills
      // based on what the app actually uses (targets read from .browserslistrc).
      // core-js patches globals, so the polyfills it injects here also cover the
      // dependencies below at runtime.
      exclude: /node_modules/,
      presets: [
        ['@babel/preset-env', { useBuiltIns: 'usage', corejs: '3.49' }],
        '@babel/preset-typescript',
      ],
    },
    {
      // Dependencies: only lower ES6+ syntax to ES5. Do NOT inject polyfills
      // here — useBuiltIns:'usage' over deps pulls in hundreds of core-js
      // modules (URL, typed arrays, ...) that bloat every bundle. They rely on
      // the globals polyfilled by the app code above.
      include: /node_modules/,
      presets: [['@babel/preset-env', { useBuiltIns: false }]],
    },
  ],
};
