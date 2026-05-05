const webpack = require('webpack');
const path = require('path');
const fs = require('fs');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const LessPluginCleanCSS = require('less-plugin-clean-css');
const SitemapPlugin = require('sitemap-webpack-plugin').default;
const RobotstxtPlugin = require('robotstxt-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

// Dynamically generate sitemap paths from HTML files in public folder
const publicDir = path.resolve(__dirname, 'public');
const sitemapPaths = fs.readdirSync(publicDir)
  .filter(file => file.endsWith('.html'))
  .map(file => {
    const filePath = path.join(publicDir, file);
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


const config = {
  mode: 'production',
  entry: {
    atmega: './src/atmega.ts',
    bally: './src/bally.ts',
    bpatcher: './src/bpatcher.ts',
    bw: './src/bw.less',
    db: './src/db.less',
    dbwrite: './src/dbwrite.ts',
    eeprom: './src/eeprom.ts',
    fileMappings: './src/fileMappings.ts',
    game: './src/game.ts',
    isp: './src/isp.ts',
    pt: './src/pt.ts',
    readout: './src/readout.ts',
    sound: './src/sound.ts',
    splitter: './src/splitter.ts',
    style: './src/style.less',
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
        test: /\.less$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          {
            loader: 'less-loader',
            options: {
              lessOptions: {
                plugins: [
                  new LessPluginCleanCSS({ advanced: true })
                ]
              }
            }
          }
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
