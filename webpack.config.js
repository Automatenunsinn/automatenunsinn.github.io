const webpack = require('webpack');
const path = require('path');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const LessPluginCleanCSS = require('less-plugin-clean-css');


const config = {
  mode: 'production',
  entry: {
    bally: './src/bally.ts',
    eeprom: './src/eeprom.ts',
    game: './src/game.ts',
    pt: './src/pt.ts',
    teileliste: './src/teileliste.ts',
    zl: './src/zl.ts',
    zlk_eeprom: './src/zlk_eeprom.ts',
    splitter: './src/splitter.ts',
    style: './src/style.less',
  },
  output: {
    path: path.resolve(__dirname, 'public'),
    filename: '[name].js'
  },
  module: {
    rules: [
      {
        test: /\.ts(x)?$/,
        loader: 'ts-loader',
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
  ],
  optimization: {
    usedExports: false,
  }
};

module.exports = config;