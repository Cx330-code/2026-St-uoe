/**
 * Integration Tests for Authentication Routes
 * Tests LO3: Integration Testing
 *
 * Purpose: Test authentication endpoints with database integration
 */

const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const authRoutes = require("../../src/routes/authRoutes");
const User = require("../../src/models/User");
const RefreshToken = require("../../src/models/RefreshToken");

describe("Authentication Routes - Integration Tests", () => {
  let app;
  let mongoServer;

  beforeAll(async () => {
    // Create in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri);

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use("/api/auth", authRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear database before each test
    await User.deleteMany({});
    await RefreshToken.deleteMany({});
  });

  describe("POST /api/auth/register", () => {
    test("should register a new user successfully", async () => {
      const userData = {
        email: "test@example.com",
        password: "Password123!",
        firstName: "John",
        lastName: "Doe",
        role: "driver",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      expect(response.body.message).toBe("User registered successfully");

      // Verify user was created in database
      const user = await User.findOne({ email: userData.email });
      expect(user).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.firstName).toBe(userData.firstName);
      expect(user.password).not.toBe(userData.password); // Should be hashed
    });

    test("should prevent duplicate email registration", async () => {
      const userData = {
        email: "duplicate@example.com",
        password: "Password123!",
        firstName: "Jane",
        lastName: "Doe",
        role: "mechanic",
      };

      // First registration
      await request(app).post("/api/auth/register").send(userData).expect(201);

      // Attempt duplicate registration
      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body.message).toBe("Email already in use");
    });

    test("should handle missing required fields", async () => {
      const incompleteData = {
        email: "incomplete@example.com",
        // Missing password, firstName, lastName
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(incompleteData)
        .expect(500);

      expect(response.body.message).toBe("Server error");
    });

    test("should hash password before storing", async () => {
      const userData = {
        email: "secure@example.com",
        password: "PlainTextPassword",
        firstName: "Secure",
        lastName: "User",
        role: "driver",
      };

      await request(app).post("/api/auth/register").send(userData).expect(201);

      const user = await User.findOne({ email: userData.email });
      expect(user.password).not.toBe(userData.password);
      expect(user.password).toMatch(/^\$2[aby]\$/); // Bcrypt hash pattern
    });

    test("should accept valid roles", async () => {
      const roles = ["driver", "mechanic", "admin"];

      for (const role of roles) {
        const userData = {
          email: `${role}@example.com`,
          password: "Password123!",
          firstName: "Test",
          lastName: "User",
          role: role,
        };

        await request(app)
          .post("/api/auth/register")
          .send(userData)
          .expect(201);
      }
    });
  });

  describe("POST /api/auth/login", () => {
    const testUser = {
      email: "login@example.com",
      password: "TestPassword123!",
      firstName: "Login",
      lastName: "Test",
      role: "driver",
    };

    beforeEach(async () => {
      // Create a test user for login tests
      await request(app).post("/api/auth/register").send(testUser);
    });

    test("should login successfully with correct credentials", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(typeof response.body.accessToken).toBe("string");
      expect(typeof response.body.refreshToken).toBe("string");
    });

    test("should store refresh token in database", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      const storedToken = await RefreshToken.findOne({
        refreshToken: response.body.refreshToken,
      });

      expect(storedToken).toBeDefined();
      expect(storedToken.userId).toBeDefined();
    });

    test("should reject login with wrong password", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: testUser.email,
          password: "WrongPassword123!",
        })
        .expect(400);

      expect(response.body.message).toBe("Invalid credentials");
      expect(response.body.accessToken).toBeUndefined();
    });

    test("should reject login with non-existent email", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "nonexistent@example.com",
          password: "AnyPassword123!",
        })
        .expect(400);

      expect(response.body.message).toBe("Invalid credentials");
    });

    test("should reject login with missing email", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          password: testUser.password,
        })
        .expect(400);

      expect(response.body.message).toBe("Invalid credentials");
    });

    test("should reject login with missing password", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: testUser.email,
        })
        .expect(500);
    });

    test("should return different tokens for multiple logins", async () => {
      const response1 = await request(app).post("/api/auth/login").send({
        email: testUser.email,
        password: testUser.password,
      });

      const response2 = await request(app).post("/api/auth/login").send({
        email: testUser.email,
        password: testUser.password,
      });

      expect(response1.body.accessToken).not.toBe(response2.body.accessToken);
      expect(response1.body.refreshToken).not.toBe(response2.body.refreshToken);
    });

    test("should handle case-sensitive email", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: testUser.email.toUpperCase(),
          password: testUser.password,
        })
        .expect(400);

      expect(response.body.message).toBe("Invalid credentials");
    });
  });

  describe("Registration and Login Flow", () => {
    test("should complete full registration and login flow", async () => {
      const userData = {
        email: "fullflow@example.com",
        password: "FlowPassword123!",
        firstName: "Full",
        lastName: "Flow",
        role: "mechanic",
      };

      // Step 1: Register
      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      expect(registerResponse.body.message).toBe(
        "User registered successfully"
      );

      // Step 2: Login with registered credentials
      const loginResponse = await request(app)
        .post("/api/auth/login")
        .send({
          email: userData.email,
          password: userData.password,
        })
        .expect(200);

      expect(loginResponse.body.accessToken).toBeDefined();
      expect(loginResponse.body.refreshToken).toBeDefined();
    });
  });

  describe("Database Constraints and Validation", () => {
    test("should enforce unique email constraint", async () => {
      const user1 = {
        email: "unique@example.com",
        password: "Password1",
        firstName: "User",
        lastName: "One",
        role: "driver",
      };

      const user2 = {
        email: "unique@example.com",
        password: "Password2",
        firstName: "User",
        lastName: "Two",
        role: "mechanic",
      };

      await request(app).post("/api/auth/register").send(user1).expect(201);
      await request(app).post("/api/auth/register").send(user2).expect(400);

      const userCount = await User.countDocuments({
        email: "unique@example.com",
      });
      expect(userCount).toBe(1);
    });
  });

  describe("Error Handling", () => {
    test("should handle malformed JSON", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .set("Content-Type", "application/json")
        .send("{ invalid json }")
        .expect(400);
    });

    test("should handle empty request body", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({})
        .expect(500);
    });
  });

  describe("Security Requirements", () => {
    test("should not expose password in any response", async () => {
      const userData = {
        email: "security@example.com",
        password: "SecurePassword123!",
        firstName: "Security",
        lastName: "Test",
        role: "driver",
      };

      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send(userData);

      expect(JSON.stringify(registerResponse.body)).not.toContain(
        userData.password
      );

      const loginResponse = await request(app).post("/api/auth/login").send({
        email: userData.email,
        password: userData.password,
      });

      expect(JSON.stringify(loginResponse.body)).not.toContain(
        userData.password
      );
    });
  });
});
