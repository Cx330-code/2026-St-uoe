/**
 * Unit Tests for Password Hashing Utility
 * Tests LO2: Code Instrumentation & LO3: Unit Testing
 *
 * Purpose: Validate password hashing functionality in isolation
 */

const bcrypt = require("bcrypt");
const hashPassword = require("../../src/utils/hashPassword");

describe("hashPassword Utility - Unit Tests", () => {
  describe("Functional Requirements", () => {
    test("should hash a valid password successfully", async () => {
      const password = "TestPassword123!";
      const hashedPassword = await hashPassword(password);

      expect(hashedPassword).toBeDefined();
      expect(typeof hashedPassword).toBe("string");
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(0);
    });

    test("should generate different hashes for the same password", async () => {
      const password = "SamePassword123";
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      // Due to salt, hashes should be different
      expect(hash1).not.toBe(hash2);

      // But both should be valid and verifiable
      const isValid1 = await bcrypt.compare(password, hash1);
      const isValid2 = await bcrypt.compare(password, hash2);
      expect(isValid1).toBe(true);
      expect(isValid2).toBe(true);
    });

    test("should hash empty string", async () => {
      const password = "";
      const hashedPassword = await hashPassword(password);

      expect(hashedPassword).toBeDefined();
      expect(typeof hashedPassword).toBe("string");
    });

    test("should hash special characters correctly", async () => {
      const password = "!@#$%^&*()_+-=[]{}|;:,.<>?";
      const hashedPassword = await hashPassword(password);

      const isValid = await bcrypt.compare(password, hashedPassword);
      expect(isValid).toBe(true);
    });

    test("should hash long password", async () => {
      const password = "a".repeat(100);
      const hashedPassword = await hashPassword(password);

      const isValid = await bcrypt.compare(password, hashedPassword);
      expect(isValid).toBe(true);
    });
  });

  describe("Security Requirements", () => {
    test("should use bcrypt salt rounds correctly", async () => {
      const password = "SecurePass123";
      const hashedPassword = await hashPassword(password);

      // Bcrypt hash should start with $2b$ and have proper format
      expect(hashedPassword).toMatch(/^\$2[aby]\$\d{2}\$/);
    });

    test("should produce hash that cannot be reversed", async () => {
      const password = "CannotReverse123";
      const hashedPassword = await hashPassword(password);

      // Verify the original password is not contained in hash
      expect(hashedPassword).not.toContain(password);
    });
  });

  describe("Edge Cases & Robustness", () => {
    test("should handle unicode characters", async () => {
      const password = "密码测试🔒";
      const hashedPassword = await hashPassword(password);

      const isValid = await bcrypt.compare(password, hashedPassword);
      expect(isValid).toBe(true);
    });

    test("should handle whitespace in password", async () => {
      const password = "  spaces  around  ";
      const hashedPassword = await hashPassword(password);

      const isValid = await bcrypt.compare(password, hashedPassword);
      expect(isValid).toBe(true);
    });

    test("should handle null gracefully", async () => {
      await expect(hashPassword(null)).rejects.toThrow();
    });

    test("should handle undefined gracefully", async () => {
      await expect(hashPassword(undefined)).rejects.toThrow();
    });
  });

  describe("Performance Requirements", () => {
    test("should hash password within reasonable time", async () => {
      const password = "PerformanceTest123";
      const startTime = Date.now();

      await hashPassword(password);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 1 second
      expect(duration).toBeLessThan(1000);
    });
  });

  describe("Basic Properties", () => {
    test("should return a string type", async () => {
      const result = await hashPassword("test");
      expect(typeof result).toBe("string");
    });

    test("should return non-empty string", async () => {
      const result = await hashPassword("password");
      expect(result.length).toBeGreaterThan(0);
    });

    test("should produce hash longer than input", async () => {
      const input = "short";
      const result = await hashPassword(input);
      expect(result.length).toBeGreaterThan(input.length);
    });

    test("should contain bcrypt prefix", async () => {
      const result = await hashPassword("test");
      expect(result.startsWith("$2")).toBe(true);
    });

    test("should handle single character", async () => {
      const result = await hashPassword("a");
      expect(result).toBeTruthy();
    });

    test("should handle numeric strings", async () => {
      const result = await hashPassword("123456");
      expect(result).toBeTruthy();
    });

    test("should handle mixed case", async () => {
      const result = await hashPassword("TeSt");
      expect(result).toBeTruthy();
    });

    test("should not return original password", async () => {
      const password = "secretPassword";
      const result = await hashPassword(password);
      expect(result).not.toBe(password);
    });
  });
});
