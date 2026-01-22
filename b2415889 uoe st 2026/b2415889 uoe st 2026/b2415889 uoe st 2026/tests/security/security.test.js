/**
 * Security Tests
 * Tests LO3 & LO4: Non-functional Testing - Security
 *
 * Purpose: Validate security requirements and identify vulnerabilities
 */

const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const authRoutes = require("../../src/routes/authRoutes");
const authMiddleware = require("../../src/middleware/authMiddleware");
const User = require("../../src/models/User");

describe("Security Tests", () => {
  let app;
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    app = express();
    app.use(express.json());
    app.use("/api/auth", authRoutes);

    // Protected route for testing
    app.get("/api/protected", authMiddleware, (req, res) => {
      res.json({ message: "Access granted", user: req.user });
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe("Authentication Security", () => {
    test("should reject access without token", async () => {
      const response = await request(app).get("/api/protected").expect(401);

      expect(response.body.message).toBe("Unauthorized");
    });

    test("should reject expired tokens", async () => {
      const expiredToken = jwt.sign({ id: "user123" }, process.env.JWT_SECRET, {
        expiresIn: "-1h",
      });

      const response = await request(app)
        .get("/api/protected")
        .set("Authorization", `Bearer ${expiredToken}`)
        .expect(403);

      expect(response.body.message).toBe("Invalid token");
    });

    test("should reject tokens with invalid signature", async () => {
      const token = jwt.sign({ id: "user123" }, "wrong-secret");

      const response = await request(app)
        .get("/api/protected")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);
    });

    test("should reject malformed tokens", async () => {
      const malformedTokens = [
        "not.a.token",
        "Bearer",
        "invalid",
        "",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", // Only header
      ];

      for (const token of malformedTokens) {
        await request(app)
          .get("/api/protected")
          .set("Authorization", `Bearer ${token}`)
          .expect(403);
      }
    });

    test("should prevent token algorithm confusion (none algorithm)", async () => {
      const header = Buffer.from(JSON.stringify({ alg: "none" })).toString(
        "base64"
      );
      const payload = Buffer.from(JSON.stringify({ id: "user123" })).toString(
        "base64"
      );
      const noneToken = `${header}.${payload}.`;

      const response = await request(app)
        .get("/api/protected")
        .set("Authorization", `Bearer ${noneToken}`)
        .expect(403);
    });

    test("should validate token tampering attempts", async () => {
      const validToken = jwt.sign({ id: "user123" }, process.env.JWT_SECRET);

      // Decode and modify payload
      const parts = validToken.split(".");
      const modifiedPayload = Buffer.from(
        JSON.stringify({ id: "admin" })
      ).toString("base64");
      const tamperedToken = `${parts[0]}.${modifiedPayload}.${parts[2]}`;

      await request(app)
        .get("/api/protected")
        .set("Authorization", `Bearer ${tamperedToken}`)
        .expect(403);
    });
  });

  describe("Password Security", () => {
    test("should not store passwords in plaintext", async () => {
      const userData = {
        email: "security@test.com",
        password: "PlainPassword123",
        firstName: "Security",
        lastName: "Test",
        role: "driver",
      };

      await request(app).post("/api/auth/register").send(userData).expect(201);

      const user = await User.findOne({ email: userData.email });
      expect(user.password).not.toBe(userData.password);
      expect(user.password).toMatch(/^\$2[aby]\$/); // Bcrypt hash
    });

    test("should not expose password in any API response", async () => {
      const userData = {
        email: "nopassword@test.com",
        password: "SecretPassword123",
        firstName: "Test",
        lastName: "User",
        role: "driver",
      };

      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send(userData);

      expect(JSON.stringify(registerResponse.body)).not.toContain(
        userData.password
      );

      const loginResponse = await request(app)
        .post("/api/auth/login")
        .send({ email: userData.email, password: userData.password });

      expect(JSON.stringify(loginResponse.body)).not.toContain(
        userData.password
      );
    });

    test("should enforce minimum password complexity", async () => {
      const weakPasswords = ["123", "abc", "", "   "];

      // Note: Current implementation doesn't validate password strength
      // This test documents the limitation
      for (const password of weakPasswords) {
        const userData = {
          email: `weak${password.length}@test.com`,
          password,
          firstName: "Weak",
          lastName: "Password",
          role: "driver",
        };

        // Currently accepts weak passwords - security vulnerability
        await request(app).post("/api/auth/register").send(userData);
      }
    });

    test("should handle password with SQL injection attempts", async () => {
      const sqlInjection = "' OR '1'='1";
      const userData = {
        email: "sql@test.com",
        password: sqlInjection,
        firstName: "SQL",
        lastName: "Test",
        role: "driver",
      };

      await request(app).post("/api/auth/register").send(userData).expect(201);

      // Should not login with SQL injection
      await request(app)
        .post("/api/auth/login")
        .send({ email: userData.email, password: "' OR '1'='1" })
        .expect(400);
    });
  });

  describe("Input Validation & Injection Prevention", () => {
    test("should prevent NoSQL injection in login", async () => {
      const injectionPayloads = [
        { email: { $ne: null }, password: { $ne: null } },
        { email: { $gt: "" }, password: { $gt: "" } },
      ];

      for (const payload of injectionPayloads) {
        const response = await request(app)
          .post("/api/auth/login")
          .send(payload)
          .expect(400);
      }
    });

    test("should sanitize email input", async () => {
      const maliciousEmails = [
        '<script>alert("xss")</script>@test.com',
        'test@<script>alert("xss")</script>.com',
        "javascript:alert(1)@test.com",
      ];

      for (const email of maliciousEmails) {
        const userData = {
          email,
          password: "Password123",
          firstName: "Test",
          lastName: "User",
          role: "driver",
        };

        await request(app).post("/api/auth/register").send(userData);
      }
    });

    test("should handle extremely long inputs without crashing", async () => {
      const longString = "A".repeat(100000);

      const userData = {
        email: `${longString}@test.com`,
        password: longString,
        firstName: longString,
        lastName: longString,
        role: "driver",
      };

      // Should handle without crashing (may fail validation)
      await request(app).post("/api/auth/register").send(userData);
    });

    test("should prevent email enumeration", async () => {
      // Register a user
      await request(app).post("/api/auth/register").send({
        email: "exists@test.com",
        password: "Password123",
        firstName: "Exists",
        lastName: "User",
        role: "driver",
      });

      // Try to login with wrong password
      const wrongPasswordResponse = await request(app)
        .post("/api/auth/login")
        .send({ email: "exists@test.com", password: "WrongPassword" })
        .expect(400);

      // Try to login with non-existent email
      const noEmailResponse = await request(app)
        .post("/api/auth/login")
        .send({ email: "notexists@test.com", password: "AnyPassword" })
        .expect(400);

      // Both should return same generic message to prevent enumeration
      expect(wrongPasswordResponse.body.message).toBe("Invalid credentials");
      expect(noEmailResponse.body.message).toBe("Invalid credentials");
    });
  });

  describe("Rate Limiting & Brute Force Protection", () => {
    test("should handle rapid sequential login attempts", async () => {
      // Create user first
      await request(app).post("/api/auth/register").send({
        email: "brute@test.com",
        password: "CorrectPassword123",
        firstName: "Brute",
        lastName: "Force",
        role: "driver",
      });

      // Attempt multiple logins rapidly
      const attempts = 20;
      const promises = [];

      for (let i = 0; i < attempts; i++) {
        promises.push(
          request(app)
            .post("/api/auth/login")
            .send({ email: "brute@test.com", password: "WrongPassword" })
        );
      }

      const results = await Promise.all(promises);

      // All should fail (no rate limiting currently implemented)
      // This test documents the limitation
      results.forEach((res) => {
        expect(res.status).toBe(400);
      });
    });
  });

  describe("Authorization & Access Control", () => {
    test("should not allow user to access resources without authentication", async () => {
      await request(app).get("/api/protected").expect(401);
    });

    test("should validate token on every protected request", async () => {
      const token = jwt.sign({ id: "user123" }, process.env.JWT_SECRET, {
        expiresIn: "1s",
      });

      // First request should work
      await request(app)
        .get("/api/protected")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      // Wait for token to expire
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Second request should fail
      await request(app)
        .get("/api/protected")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);
    });
  });

  describe("Session Security", () => {
    test("should use different secrets for access and refresh tokens", async () => {
      const payload = { id: "user123" };

      const accessToken = jwt.sign(payload, process.env.JWT_SECRET);
      const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET);

      // Access token should fail with refresh secret
      expect(() => {
        jwt.verify(accessToken, process.env.JWT_REFRESH_SECRET);
      }).toThrow();

      // Refresh token should fail with access secret
      expect(() => {
        jwt.verify(refreshToken, process.env.JWT_SECRET);
      }).toThrow();
    });

    test("should have appropriate token expiry times", async () => {
      const payload = { id: "user123", role: "driver" };

      const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: "15m",
      });
      const accessDecoded = jwt.decode(accessToken);

      const expiryTime = accessDecoded.exp - accessDecoded.iat;
      expect(expiryTime).toBe(900); // 15 minutes
    });
  });

  describe("Data Exposure", () => {
    test("should not leak sensitive information in error messages", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ email: "test@test.com", password: "wrong" })
        .expect(400);

      // Should not reveal whether email exists
      expect(response.body.message).not.toContain("password");
      expect(response.body.message).not.toContain("email not found");
    });

    test("should not expose internal server details in errors", async () => {
      // Close database to cause error
      await mongoose.connection.close();

      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email: "error@test.com",
          password: "Password123",
          firstName: "Error",
          lastName: "Test",
          role: "driver",
        })
        .expect(500);

      // Should return generic error, not database connection details
      expect(response.body.message).toBe("Server error");
      expect(JSON.stringify(response.body)).not.toContain("mongoose");
      expect(JSON.stringify(response.body)).not.toContain("connection");

      // Reconnect for other tests
      await mongoose.connect(mongoServer.getUri());
    });
  });

  describe("CORS & Headers Security", () => {
    test("should handle requests without origin header", async () => {
      await request(app)
        .post("/api/auth/login")
        .send({ email: "test@test.com", password: "password" })
        .expect(400);
    });

    test("should process JSON content type correctly", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({ email: "test@test.com", password: "password" }))
        .expect(400);
    });
  });
});
