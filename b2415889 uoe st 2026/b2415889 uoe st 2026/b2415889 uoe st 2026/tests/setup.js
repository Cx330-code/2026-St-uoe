// Test setup file
// Set test environment variables
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-key-12345";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-key-12345";
process.env.PORT = 5001;

// Increase timeout for integration tests
jest.setTimeout(10000);

// Mock console methods to reduce noise in tests (optional)
global.console = {
  ...console,
  log: jest.fn(), // Suppress logs
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(), // Keep errors visible
};
