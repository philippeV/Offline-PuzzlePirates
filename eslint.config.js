import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export const simPurityRules = {
  'no-restricted-globals': [
    'error',
    { name: 'globalThis', message: 'The simulation core reaches for no global.' },
    { name: 'crypto', message: 'Draw from a named RNG stream instead.' },
    { name: 'setTimeout', message: 'The simulation has no wall clock.' },
    { name: 'setInterval', message: 'The simulation has no wall clock.' },
    { name: 'process', message: 'The simulation core reaches for no host.' },
  ],
  'no-restricted-properties': [
    'error',
    { object: 'Math', property: 'random', message: 'Draw from a named RNG stream instead.' },
    { object: 'Date', property: 'now', message: 'The simulation has no wall clock.' },
    { object: 'Date', property: 'parse', message: 'The simulation has no wall clock.' },
    { object: 'performance', property: 'now', message: 'The simulation has no wall clock.' },
  ],
  'no-restricted-syntax': [
    'error',
    {
      selector: "NewExpression[callee.name='Date']",
      message: 'The simulation has no wall clock.',
    },
    {
      selector: 'ImportDeclaration[source.value=/^[^.]/]',
      message: 'The simulation core imports nothing outside itself.',
    },
    {
      selector: 'ImportExpression[source.value=/^[^.]/]',
      message: 'The simulation core imports nothing outside itself.',
    },
    {
      selector: 'TSImportType[source.value=/^[^.]/]',
      message: 'The simulation core imports nothing outside itself.',
    },
  ],
};

export default tseslint.config(
  { ignores: ['node_modules/**', 'tests/gates/fixtures/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['packages/sim/src/**/*.ts'],
    rules: simPurityRules,
  },
  {
    files: ['tests/gates/fixtures/**/*.ts'],
    rules: simPurityRules,
  },
);
