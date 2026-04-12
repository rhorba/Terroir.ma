import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testTimeout: 120000,
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@common/(.*)$': '<rootDir>/src/common/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
  },
  collectCoverageFrom: [
    'src/modules/**/*.service.ts',
    'src/modules/**/*.listener.ts',
    '!src/**/*.spec.ts',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/test/unit/**/*.spec.ts'],
      transform: { '^.+\\.(t|j)s$': 'ts-jest' },
      moduleNameMapper: {
        '^@common/(.*)$': '<rootDir>/src/common/$1',
        '^@modules/(.*)$': '<rootDir>/src/modules/$1',
        '^@config/(.*)$': '<rootDir>/src/config/$1',
        '^@shared/(.*)$': '<rootDir>/shared/$1',
      },
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/test/integration/**/*.integration.ts'],
      transform: { '^.+\\.(t|j)s$': 'ts-jest' },
      moduleNameMapper: {
        '^@common/(.*)$': '<rootDir>/src/common/$1',
        '^@modules/(.*)$': '<rootDir>/src/modules/$1',
        '^@config/(.*)$': '<rootDir>/src/config/$1',
        '^@shared/(.*)$': '<rootDir>/shared/$1',
      },
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/test/e2e/**/*.e2e.ts'],
      transform: { '^.+\\.(t|j)s$': 'ts-jest' },
      moduleNameMapper: {
        '^@common/(.*)$': '<rootDir>/src/common/$1',
        '^@modules/(.*)$': '<rootDir>/src/modules/$1',
        '^@config/(.*)$': '<rootDir>/src/config/$1',
        '^@shared/(.*)$': '<rootDir>/shared/$1',
      },
    },
  ],
};

export default config;
