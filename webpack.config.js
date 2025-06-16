const webpack = require('webpack');
const path = require('path');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

const config = {
  mode: 'production',
  entry: {
    bally: './src/bally.ts',
    eeprom: './src/eeprom.ts',
    pt: './src/pt.ts',
    teileliste: './src/teileliste.ts',
    zl: './src/zl.ts',
    zlk_eeprom: './src/zlk_eeprom.ts',
    style: './src/style.less',
  },
  output: {
    path: path.resolve(__dirname, 'public'),
    filename: '[name].js' // Use [name] placeholder for output filenames
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
          'less-loader'
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
      filename: 'style.css', // Schreibe das CSS als public/style.css
    }),
  ],
  optimization: {
    usedExports: false,
    minimizer: [
      '...', // Behalte bestehende Minimizer (z.B. Terser)
      new CssMinimizerPlugin(), // CSS minifizieren
    ],
  }
};

module.exports = config;