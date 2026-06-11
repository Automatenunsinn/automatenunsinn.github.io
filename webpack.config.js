const webpack = require('webpack');
const path = require('path');
const fs = require('fs');
const child_process = require('child_process');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const SitemapPlugin = require('sitemap-webpack-plugin').default;
const RobotstxtPlugin = require('robotstxt-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const esbuild = require('esbuild');

// Load a TypeScript module at config-evaluation time by bundling it to CJS with
// esbuild (dependencies like papaparse are bundled in) and evaluating it.
function loadTsModule(tsPath) {
  const result = esbuild.buildSync({
    entryPoints: [tsPath],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    logLevel: 'silent',
  });
  const code = result.outputFiles[0].text;
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', '__dirname', '__filename', code)(
    mod, mod.exports, require, path.dirname(tsPath), tsPath
  );
  return mod.exports;
}

// Pre-render the parts list table from teile.tsv so it ships inside
// teileliste.html and is indexable by search engines (rather than being fetched
// and rendered in the browser at runtime).
const { renderTeileTable } = loadTsModule(path.resolve(__dirname, 'src/utils/teileTable.ts'));
const teileTableHtml = renderTeileTable(
  fs.readFileSync(path.resolve(__dirname, 'src/teile.tsv'), 'utf-8')
);

// Dynamically generate sitemap paths from HTML templates in src/pages
const publicDir = path.resolve(__dirname, 'public');
const pageDir = path.resolve(__dirname, 'src/pages');
const sitemapPaths = fs.readdirSync(pageDir)
  .filter(file => file.endsWith('.html'))
  .map(file => {
    const filePath = path.join(pageDir, file);
    const stats = fs.statSync(filePath);
    return {
      path: file === 'index.html' ? '/' : `/${file}`,
      lastmod: stats.mtime.toISOString()
    };
  })
  .sort((a, b) => {
    if (a.path === '/') return -1;
    if (b.path === '/') return 1;
    return a.path.localeCompare(b.path);
  });

function getGitCommitHash() {
  try {
    return child_process.execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch (error) {
    console.warn('Warning: could not determine git commit hash, using fallback.');
    return 'unknown';
  }
}

const commitHash = getGitCommitHash();
const footerHtml = fs.existsSync(path.join(__dirname, 'src/footer.html'))
  ? fs.readFileSync(path.join(__dirname, 'src/footer.html'), 'utf-8')
  : '';

const darkHtml = fs.existsSync(path.join(__dirname, 'src/dark.html'))
  ? fs.readFileSync(path.join(__dirname, 'src/dark.html'), 'utf-8')
  : '';

const htmlPages = fs.readdirSync(pageDir)
  .filter(file => file.endsWith('.html'))
  .map(file => new HtmlWebpackPlugin({
    filename: file,
    templateContent: () => {
      let html = fs.readFileSync(path.resolve(pageDir, file), 'utf-8')
        .replace('</body>', footerHtml + '</body>' + darkHtml);
      if (file === 'teileliste.html') {
        html = html.replace(
          '<div id="table-container"></div>',
          `<div id="table-container">${teileTableHtml}</div>`
        );
      }
      return html;
    },
    inject: false,
    minify: false,
  }));
const output = {
  path: path.resolve(__dirname, 'public'),
  filename: '[name].js'
};

const resolveOptions = {
  extensions: ['.tsx', '.ts', '.js'],
  alias: {
    // Use crc's CommonJS build (require("buffer")) instead of its ESM build,
    // whose `import { Buffer } from 'buffer'` does not interop with the CJS
    // buffer polyfill. Both src usages import from the 'crc' package root.
    crc$: path.resolve(__dirname, 'node_modules/crc/cjs-default-unwrap/index.js')
  },
  fallback: {
    buffer: require.resolve('buffer/') // Polyfill Buffer
  }
};

// Pages that don't use the Web Serial API: keep the iOS 9 pipeline
// (babel-loader + core-js polyfills, ES5 output).
const legacyConfig = {
  name: 'legacy',
  mode: 'production',
  // Emit ES5 runtime/module wrappers (and configure the minifier for ES5).
  // Without this, webpack 5 uses ES6 object-method shorthand and arrow
  // functions in its bootstrap code, which throws a SyntaxError on iOS 9.
  target: ['web', 'es5'],
  entry: {
    bally: './src/bally.ts',
    bpatcher: './src/bpatcher.ts',
    bw: './src/bw.scss',
    db: './src/db.scss',
    game: './src/game.ts',
    pt: './src/pt.ts',
    splitter: './src/splitter.ts',
    style: './src/style.scss',
    teileliste: './src/teileliste.ts',
    zl: './src/zl.ts',
    zlk_v1: './src/zlk_v1.ts',
  },
  output,
  module: {
    rules: [
      {
        // TypeScript app code: strip types + lower syntax/polyfills to the
        // .browserslistrc target (iOS >= 9) via @babel/preset-env.
        test: /\.ts(x)?$/,
        loader: 'babel-loader',
        exclude: /node_modules/
      },
      {
        // Many deps resolve to their ESM builds (papaparse, crc, ...) which
        // ship ES6+ syntax that would throw a SyntaxError on iOS 9, so transpile
        // node_modules too. Skip the polyfill packages to avoid self-referencing.
        // (crc is aliased to its CJS build below to dodge an ESM/CJS Buffer
        // interop error.)
        test: /\.js$/,
        loader: 'babel-loader',
        include: /node_modules/,
        exclude: /node_modules[\\/](core-js|@babel[\\/]runtime|regenerator-runtime)[\\/]/
      },
      {
        test: /\.s[ac]ss$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          'sass-loader'
        ],
        exclude: /node_modules/
      }
    ]
  },
  resolve: resolveOptions,
  plugins: [
    new NodePolyfillPlugin(),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'src/sw.js',
          to: 'sw.js',
          transform(content) {
            return content.toString().replace(/automatenunsinn-v4/g, `automatenunsinn-${commitHash}`);
          },
        },
        {
          // teile.tsv is now pre-rendered into teileliste.html at build time, so
          // only ptb.csv (used at runtime by the splitter) needs copying.
          from: "src/ptb.csv",
          to({ context, absoluteFilename }) {
            return Promise.resolve("[name][ext]");
          },
        },
      ],
    }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    new MiniCssExtractPlugin({
      filename: '[name].css'
    }),
    ...htmlPages,
    new SitemapPlugin({
      base: 'https://automatenunsinn.github.io',
      paths: sitemapPaths,
    }),
    new RobotstxtPlugin({
      policy: [
        {
          userAgent: '*',
          allow: '/',
        },
      ],
      sitemap: 'https://automatenunsinn.github.io/sitemap.xml',
    }),
  ],
  optimization: {
    usedExports: true,
  }
};

// Pages built around the Web Serial API, which only exists in Chromium 89+
// (never on iOS). No babel/core-js polyfills needed — esbuild just strips
// types and lowers syntax to ES2020, which all Web-Serial-capable browsers
// understand.
const serialConfig = {
  name: 'serial',
  mode: 'production',
  target: ['web', 'es2020'],
  entry: {
    atmega: './src/atmega.ts',
    dbwrite: './src/dbwrite.ts',
    isp: './src/isp.ts',
    readout: './src/readout.ts',
    sound: './src/sound.ts',
    vdai: './src/vdai.ts',
    zlk_eeprom: './src/zlk_eeprom.ts',
  },
  output,
  module: {
    rules: [
      {
        test: /\.ts(x)?$/,
        loader: 'esbuild-loader',
        options: { target: 'es2020' },
        exclude: /node_modules/
      }
    ]
  },
  resolve: resolveOptions,
  plugins: [
    new NodePolyfillPlugin(),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
  ],
  optimization: {
    usedExports: true,
  }
};

module.exports = [legacyConfig, serialConfig];

