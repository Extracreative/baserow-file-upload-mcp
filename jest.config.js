export default {
  testEnvironment: 'node',
  globals: {
    'NODE_OPTIONS': '--experimental-vm-modules'
  },
  transform: {},
  collectCoverageFrom: [
    '*.js',
    '!test/**',
    '!.eslintrc.js',
    '!jest.config.js'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: [
    '**/test/**/*.test.js'
  ],
  verbose: true
};
