const { createDefaultPreset } = require("ts-jest");
const tsJestTransformCfg = createDefaultPreset().transform;

module.exports = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
  moduleNameMapper: {
    '^server-only$': '<rootDir>/__mocks__/server-only.js',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
