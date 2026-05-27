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

const htmlPages = fs.readdirSync(pageDir)
  .filter(file => file.endsWith('.html'))
  .map(file => new HtmlWebpackPlugin({
    filename: file,
    template: path.resolve(pageDir, file),
    inject: false,
    minify: false,
    templateParameters: {
      footer: footerHtml,
    },
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
            return content.toString().replace(/automatenunsinn-v2/g, `automatenunsinn-${commitHash}`);
          },
        },
        {
          from: "src/*.*sv",
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

