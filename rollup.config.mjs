import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import copy from 'rollup-plugin-copy';

export default {
  input: 'src/geo-clock-card.ts',
  output: {
    file: 'dist/geo-clock-card.js',
    format: 'es',
    sourcemap: true,
  },
  plugins: [
    resolve(),
    commonjs(),
    typescript({ tsconfig: './tsconfig.json' }),
    copy({
      targets: [
        { src: 'assets/*.jpg', dest: 'dist' },
        { src: 'assets/timezones.json', dest: 'dist' },
      ],
      // Don't fail the build if assets aren't downloaded yet — the user
      // runs `npm run fetch-assets` once before first install.
      copyOnce: false,
    }),
    terser(),
  ],
};
