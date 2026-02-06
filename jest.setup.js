/**
 * Jest setup file
 * Runs before each test suite
 */

// Suppress console errors during tests (optional)
// global.console = {
//   ...console,
//   error: jest.fn(),
//   warn: jest.fn(),
// };

// Set test timeout
jest.setTimeout(10000);

// Mock environment variables
process.env.NODE_ENV = 'test';

// Add custom matchers or global test utilities here
