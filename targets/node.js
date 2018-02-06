const path = require('path');
const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  target: 'node',
  entry: './src/index.js',
  externals: [nodeExternals()],
  output: {
    libraryTarget: 'commonjs2',
    path: path.resolve(__dirname, '..', 'dist'),
    filename: 'index.js',
  },
  plugins: [new webpack.optimize.ModuleConcatenationPlugin()],
  module: {
    rules: [
      {
        enforce: 'pre',
        test: /\.js$/,
        exclude: /(node_modules)/,
        loader: 'eslint-loader',
      },
      {
        test: /\.js$/,
        exclude: /(node_modules)/,
        loader: 'babel-loader',
      },
    ],
  },
};
