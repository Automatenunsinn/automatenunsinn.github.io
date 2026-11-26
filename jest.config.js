// jest.config.js

module.exports = {
    preset: 'ts-jest',
    transform: {
      "^.+\\.(ts|tsx|js)$": "ts-jest"
    },
    moduleNameMapper: {
      '^(\\.{1,2}/.*)\\.js$': '$1'
    },
    testTimeout: 2000,
  }
