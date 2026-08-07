const eslintConfig = require('@n8n/node-cli/eslint');

module.exports = [
  ...eslintConfig.default,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    }
  }
];
