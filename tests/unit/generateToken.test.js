/**
 * Unit Tests for Token Generation Utility
 * Tests LO2: Code Instrumentation & LO3: Unit Testing
 *
 * Purpose: Validate JWT token generation in isolation
 */

const jwt = require('jsonwebtoken');
const { generateAccessToken, generateRefreshToken } = require('../../src/utils/generateToken');

describe('generateToken Utility - Unit Tests', () => {
  const testPayload = { id: 'user123', role: 'driver' };

  describe('Access Token Generation', () => {
    test('should generate valid access token with correct payload', () => {
      const token = generateAccessToken(testPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
    });

    test('should generate token that can be decoded', () => {
      const token = generateAccessToken(testPayload);
      const decoded = jwt.decode(token);

      expect(decoded.id).toBe(testPayload.id);
      expect(decoded.role).toBe(testPayload.role);
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });

    test('should generate token with correct expiry', () => {
      const token = generateAccessToken(testPayload);
      const decoded = jwt.decode(token);

      const expiryTime = decoded.exp - decoded.iat;
      // 15 minutes = 900 seconds
      expect(expiryTime).toBe(900);
    });

    test('should generate token verifiable with correct secret', () => {
      const token = generateAccessToken(testPayload);

      expect(() => {
        jwt.verify(token, process.env.JWT_SECRET);
      }).not.toThrow();
    });

    test('should fail verification with incorrect secret', () => {
      const token = generateAccessToken(testPayload);

      expect(() => {
        jwt.verify(token, 'wrong-secret');
      }).toThrow();
    });

    test('should generate different tokens for same payload', async () => {
      const token1 = generateAccessToken(testPayload);

      // Wait 1 second to ensure different iat timestamp
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const token2 = generateAccessToken(testPayload);

      // Tokens should be different due to timestamp
      expect(token1).not.toBe(token2);
    });

    test('should handle empty payload object', () => {
      const token = generateAccessToken({});
      const decoded = jwt.decode(token);

      expect(decoded).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    test('should handle complex nested payload', () => {
      const complexPayload = {
        user: {
          id: '123',
          profile: {
            name: 'Test User',
            permissions: ['read', 'write']
          }
        }
      };

      const token = generateAccessToken(complexPayload);
      const decoded = jwt.decode(token);

      expect(decoded.user.id).toBe('123');
      expect(decoded.user.profile.permissions).toEqual(['read', 'write']);
    });
  });

  describe('Refresh Token Generation', () => {
    test('should generate valid refresh token with correct payload', () => {
      const token = generateRefreshToken(testPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    test('should generate token with correct expiry (7 days)', () => {
      const token = generateRefreshToken(testPayload);
      const decoded = jwt.decode(token);

      const expiryTime = decoded.exp - decoded.iat;
      // 7 days = 604800 seconds
      expect(expiryTime).toBe(604800);
    });

    test('should generate token verifiable with correct refresh secret', () => {
      const token = generateRefreshToken(testPayload);

      expect(() => {
        jwt.verify(token, process.env.JWT_REFRESH_SECRET);
      }).not.toThrow();
    });

    test('should fail verification with access token secret', () => {
      const token = generateRefreshToken(testPayload);

      expect(() => {
        jwt.verify(token, process.env.JWT_SECRET);
      }).toThrow();
    });
  });

  describe('Token Security', () => {
    test('access token should not contain plaintext sensitive data', () => {
      const sensitivePayload = { id: 'user123', password: 'secret' };
      const token = generateAccessToken(sensitivePayload);

      // Token should not contain plaintext password
      expect(token).not.toContain('secret');

      // But decoded payload will contain it (this demonstrates why you shouldn't put passwords in JWT)
      const decoded = jwt.decode(token);
      expect(decoded.password).toBe('secret');
    });

    test('tokens should use different secrets for access and refresh', () => {
      const accessToken = generateAccessToken(testPayload);
      const refreshToken = generateRefreshToken(testPayload);

      // Access token should fail with refresh secret
      expect(() => {
        jwt.verify(accessToken, process.env.JWT_REFRESH_SECRET);
      }).toThrow();

      // Refresh token should fail with access secret
      expect(() => {
        jwt.verify(refreshToken, process.env.JWT_SECRET);
      }).toThrow();
    });
  });

  describe('Edge Cases', () => {
    test('should handle null payload gracefully', () => {
      expect(() => {
        generateAccessToken(null);
      }).toThrow();
    });

    test('should handle undefined payload gracefully', () => {
      expect(() => {
        generateAccessToken(undefined);
      }).toThrow();
    });

    test('should handle string payload', () => {
      const token = generateAccessToken({ data: 'string payload' });
      const decoded = jwt.decode(token);

      expect(decoded.data).toBe('string payload');
    });
  });

  describe('Performance', () => {
    test('should generate token quickly', () => {
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        generateAccessToken({ id: `user${i}` });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should generate 100 tokens in less than 1 second
      expect(duration).toBeLessThan(1000);
    });
  });

  describe("Token Structure", () => {
    test("should return a string", () => {
      const token = generateAccessToken({ id: 1 });
      expect(typeof token).toBe("string");
    });

    test("should not be empty", () => {
      const token = generateAccessToken({ id: 1 });
      expect(token.length).toBeGreaterThan(0);
    });

    test("should have three parts", () => {
      const token = generateAccessToken({ id: 1 });
      const parts = token.split(".");
      expect(parts).toHaveLength(3);
    });

    test("should have non-empty header", () => {
      const token = generateAccessToken({ id: 1 });
      const parts = token.split(".");
      expect(parts[0].length).toBeGreaterThan(0);
    });

    test("should have non-empty payload", () => {
      const token = generateAccessToken({ id: 1 });
      const parts = token.split(".");
      expect(parts[1].length).toBeGreaterThan(0);
    });

    test("should have non-empty signature", () => {
      const token = generateAccessToken({ id: 1 });
      const parts = token.split(".");
      expect(parts[2].length).toBeGreaterThan(0);
    });

    test("should handle empty object payload", () => {
      const token = generateAccessToken({});
      expect(token).toBeTruthy();
    });

    test("should handle payload with multiple fields", () => {
      const token = generateAccessToken({ id: 1, role: "admin", active: true });
      expect(token).toBeTruthy();
    });
  });
});
