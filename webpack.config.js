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
const config = {
  mode: 'production',
  entry: {
    atmega: './src/atmega.ts',
    bally: './src/bally.ts',
    bpatcher: './src/bpatcher.ts',
    bw: './src/bw.scss',
    db: './src/db.scss',
    dbwrite: './src/dbwrite.ts',
    eeprom: './src/eeprom.ts',
    fileMappings: './src/fileMappings.ts',
    game: './src/game.ts',
    isp: './src/isp.ts',
    pt: './src/pt.ts',
    readout: './src/readout.ts',
    sound: './src/sound.ts',
    splitter: './src/splitter.ts',
    style: './src/style.scss',
    teileliste: './src/teileliste.ts',
    vdai: './src/vdai.ts',
    zl: './src/zl.ts',
    zlk_eeprom: './src/zlk_eeprom.ts',
    zlk_v1: './src/zlk_v1.ts',
  },
  output: {
    path: path.resolve(__dirname, 'public'),
    filename: '[name].js'
  },
  module: {
    rules: [
      {
        test: /\.ts(x)?$/,
        loader: 'esbuild-loader',
        exclude: /node_modules/
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
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      buffer: require.resolve('buffer/') // Polyfill Buffer
    }
  },
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

module.exports = config;

