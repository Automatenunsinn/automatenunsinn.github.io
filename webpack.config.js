const webpack = require('webpack');
const path = require('path');
const fs = require('fs');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const LessPluginCleanCSS = require('less-plugin-clean-css');
const SitemapPlugin = require('sitemap-webpack-plugin').default;
const RobotstxtPlugin = require('robotstxt-webpack-plugin');

// Dynamically generate sitemap paths from HTML files in public folder
const publicDir = path.resolve(__dirname, 'public');
const sitemapPaths = fs.readdirSync(publicDir)
  .filter(file => file.endsWith('.html'))
  .map(file => file === 'index.html' ? '/' : `/${file}`);


const config = {
  mode: 'production',
  entry: {
    bally: './src/bally.ts',
    eeprom: './src/eeprom.ts',
    pt: './src/pt.ts',
    teileliste: './src/teileliste.ts',
    zl: './src/zl.ts',
    zlk_eeprom: './src/zlk_eeprom.ts',
    splitter: './src/splitter.ts',
    bpatcher: './src/bpatcher.ts',
    readout: './src/readout.ts',
    style: './src/style.less',
    bw: './src/bw.less',
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
    usedExports: false,
  }
};

module.exports = config;