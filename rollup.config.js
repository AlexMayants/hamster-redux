import { babel } from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';

const config = {
  input: 'src/index.js',
  plugins: [
    babel({
      babelHelpers: 'bundled'
    }),
    commonjs(),
    nodeResolve()
  ],
};

export default [
  Object.assign(
    {
      output: {
        file: 'lib/index.js',
        format: 'cjs',
        exports: 'named'
      }
    },
    config,
  ),
  Object.assign(
    {
      output: {
        file: 'es/index.js',
        format: 'esm'
      }
    },
    config,
  ),
];