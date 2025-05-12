const webpack = require('webpack');
const path = require('path');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

const config = {
  mode: 'production',
  entry: {
    bally: './src/bally.ts',
    eeprom: './src/eeprom.ts',
    pt: './src/pt.ts',
    zl: './src/zl.ts',
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
    new NodePolyfillPlugin(), // Add Node.js polyfills
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'], // Provide Buffer globally
    }),
  ],
  optimization: {
    usedExports: false
  }
};

module.exports = config;
