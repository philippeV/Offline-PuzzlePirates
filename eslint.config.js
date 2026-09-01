import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const simPurityRules = {
  'no-restricted-properties': [
    'error',
    { object: 'Math', property: 'random', message: 'Draw from a named RNG stream instead.' },
    { object: 'Date', property: 'now', message: 'The simulation has no wall clock.' },
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
      selector: 'TSImportType[argument.value=/^[^.]/]',
      message: 'The simulation core imports nothing outside itself.',
    },
  ],
};

export default tseslint.config(
  { ignores: ['node_modules/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['packages/sim/src/**/*.ts'],
    rules: simPurityRules,
  },
);
