import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default [
  {
    input: 'popup/index.js',
    output: {
      file: 'dist/popup.bundle.js',
      format: 'iife',
      globals: {
        '@google/generative-ai': 'GoogleGenerativeAI'
      }
    },
    plugins: [
      resolve(),
      commonjs()
    ]
  },
  {
    input: 'background.js',
    output: {
      file: 'dist/background.bundle.js',
      format: 'es'
    },
    plugins: [
      resolve(),
      commonjs()
    ]
  }
]; 