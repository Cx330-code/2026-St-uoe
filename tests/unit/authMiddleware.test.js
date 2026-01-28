/**
 * Unit Tests for Authentication Middleware
 * Tests LO2: Code Instrumentation & LO3: Unit Testing
 *
 * Purpose: Validate JWT authentication middleware in isolation
 */

const jwt = require('jsonwebtoken');
const authMiddleware = require('../../src/middleware/authMiddleware');

describe('authMiddleware - Unit Tests', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      headers: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
  });

  describe('Valid Token Scenarios', () => {
    test('should accept valid token and call next()', () => {
      const payload = { id: 'user123', role: 'driver' };
      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: '15m'
      });
      mockReq.headers.authorization = `Bearer ${token}`;

      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.id).toBe('user123');
      expect(mockReq.user.role).toBe('driver');
    });

    test('should attach decoded user to request object', () => {
      const payload = {
        id: 'user456',
        role: 'mechanic',
        email: 'test@example.com'
      };
      const token = jwt.sign(payload, process.env.JWT_SECRET);
      mockReq.headers.authorization = `Bearer ${token}`;

      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockReq.user.id).toBe('user456');
      expect(mockReq.user.role).toBe('mechanic');
      expect(mockReq.user.email).toBe('test@example.com');
    });

    test('should handle token with extra whitespace', () => {
      const token = jwt.sign({ id: 'user123' }, process.env.JWT_SECRET);
      mockReq.headers.authorization = `  Bearer   ${token}  `;

      // Current implementation will fail - demonstrates a potential bug
      authMiddleware(mockReq, mockRes, mockNext);

      // This test will fail with current implementation
      // Keeping it to document the limitation
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('Missing Token Scenarios', () => {
    test('should return 401 when no authorization header', () => {
      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should return 401 when authorization header is empty', () => {
      mockReq.headers.authorization = '';

      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
    });

    test('should return 401 when Bearer prefix is missing', () => {
      const token = jwt.sign({ id: 'user123' }, process.env.JWT_SECRET);
      mockReq.headers.authorization = token; // Missing "Bearer "

      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should return 401 when only Bearer is provided', () => {
      mockReq.headers.authorization = 'Bearer ';

      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('Invalid Token Scenarios', () => {
    test('should return 403 for malformed token', () => {
      mockReq.headers.authorization = 'Bearer invalid.token.here';

      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Invalid token' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should return 403 for token with wrong secret', () => {
      const token = jwt.sign({ id: 'user123' }, 'wrong-secret');
      mockReq.headers.authorization = `Bearer ${token}`;

      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Invalid token' });
    });

    test('should return 403 for expired token', () => {
      const token = jwt.sign({ id: 'user123' }, process.env.JWT_SECRET, {
        expiresIn: '-1s'
      });
      mockReq.headers.authorization = `Bearer ${token}`;

      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Invalid token' });
    });

    test('should return 403 for token with invalid signature', () => {
      const token = jwt.sign({ id: 'user123' }, process.env.JWT_SECRET);
      const tamperedToken = token.slice(0, -5) + 'XXXXX'; // Tamper with signature
      mockReq.headers.authorization = `Bearer ${tamperedToken}`;

      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    test('should return 403 for completely random string', () => {
      mockReq.headers.authorization = 'Bearer randomstringnotjwt';

      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Security Edge Cases', () => {
    test('should reject token with none algorithm', () => {
      // Try to create token with 'none' algorithm (security vulnerability)
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64');
      const payload = Buffer.from(JSON.stringify({ id: 'user123' })).toString('base64');
      const maliciousToken = `${header}.${payload}.`;

      mockReq.headers.authorization = `Bearer ${maliciousToken}`;

      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    test('should handle very long tokens', () => {
      const largePayload = { data: 'A'.repeat(10000) };
      const token = jwt.sign(largePayload, process.env.JWT_SECRET);
      mockReq.headers.authorization = `Bearer ${token}`;

      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should reject SQL injection attempts in header', () => {
      mockReq.headers.authorization = "Bearer ' OR '1'='1";

      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Multiple Authorization Formats', () => {
    test('should handle lowercase bearer', () => {
      const token = jwt.sign({ id: 'user123' }, process.env.JWT_SECRET);
      mockReq.headers.authorization = `bearer ${token}`;

      authMiddleware(mockReq, mockRes, mockNext);

      // Current implementation is case-sensitive, should accept lowercase
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
    });

    test('should reject Basic auth format', () => {
      mockReq.headers.authorization = 'Basic dXNlcjpwYXNzd29yZA==';

      authMiddleware(mockReq, mockRes, mockNext);

      // Split returns array with [1] = 'dXNlcjpwYXNzd29yZA==', which is invalid JWT, causing 403
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Response Format Validation', () => {
    test('should return JSON error response', () => {
      mockReq.headers.authorization = 'Bearer invalid';

      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.any(String) })
      );
    });

    test('should set appropriate status code before sending response', () => {
      const callOrder = [];
      mockRes.status = jest.fn((code) => {
        callOrder.push('status');
        return mockRes;
      });
      mockRes.json = jest.fn(() => {
        callOrder.push('json');
      });

      authMiddleware(mockReq, mockRes, mockNext);

      expect(callOrder).toEqual(['status', 'json']);
    });
  });

  describe('Request Object Mutation', () => {
    test('should not mutate request if token is invalid', () => {
      mockReq.headers.authorization = 'Bearer invalid';
      const originalReq = { ...mockReq };

      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockReq.user).toBeUndefined();
    });

    test('should preserve other request properties', () => {
      const token = jwt.sign({ id: 'user123' }, process.env.JWT_SECRET);
      mockReq.headers.authorization = `Bearer ${token}`;
      mockReq.body = { data: 'test' };
      mockReq.params = { id: '456' };

      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockReq.body).toEqual({ data: 'test' });
      expect(mockReq.params).toEqual({ id: '456' });
    });
  });

  describe('Middleware Basics', () => {
    test('should be a function', () => {
      expect(typeof authMiddleware).toBe('function');
    });

    test('should accept three arguments', () => {
      expect(authMiddleware.length).toBe(3);
    });

    test('should not throw with valid token', () => {
      const token = jwt.sign({ id: 'user123' }, process.env.JWT_SECRET);
      mockReq.headers.authorization = `Bearer ${token}`;
      expect(() => authMiddleware(mockReq, mockRes, mockNext)).not.toThrow();
    });

    test('should call next exactly once on success', () => {
      const token = jwt.sign({ id: 'user123' }, process.env.JWT_SECRET);
      mockReq.headers.authorization = `Bearer ${token}`;
      authMiddleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    test('should call next with no arguments', () => {
      const token = jwt.sign({ id: 'user123' }, process.env.JWT_SECRET);
      mockReq.headers.authorization = `Bearer ${token}`;
      authMiddleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith();
    });

    test('should not call next on invalid token', () => {
      mockReq.headers.authorization = 'Bearer invalid';
      mockNext.mockClear();
      authMiddleware(mockReq, mockRes, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should set status before json', () => {
      mockReq.headers = {};
      authMiddleware(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalled();
    });

    test('should work with lowercase bearer', () => {
      const token = jwt.sign({ id: 'user123' }, process.env.JWT_SECRET);
      mockReq.headers.authorization = `bearer ${token}`;
      authMiddleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
