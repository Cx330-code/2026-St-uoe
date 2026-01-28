/**
 * Integration Tests for Authentication Routes
 * Tests LO3: Integration Testing
 *
 * Purpose: Test authentication endpoints with database integration
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const authRoutes = require('../../src/routes/authRoutes');
const User = require('../../src/models/User');
const RefreshToken = require('../../src/models/RefreshToken');

describe('Authentication Routes - Integration Tests', () => {
  let app;

  beforeAll(async () => {
    // Connect to local MongoDB
    await mongoose.connect('mongodb://localhost:27017/rsachat');

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
  }, 120000); // Increased timeout for MongoDB Memory Server download

  afterAll(async () => {
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    // Clear database before each test
    await User.deleteMany({});
    await RefreshToken.deleteMany({});
  });

  describe('POST /api/auth/register', () => {
    test('should handle missing required fields', async () => {
      const incompleteData = {
        email: 'incomplete@example.com'
        // Missing password, firstName, lastName
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(incompleteData)
        .expect(500);

      expect(response.body.message).toBe('Server error');
    });

    test('should hash password before storing', async () => {
      const userData = {
        email: 'secure@example.com',
        password: 'PlainTextPassword',
        firstName: 'Secure',
        lastName: 'User',
        role: 'driver'
      };

      await request(app).post('/api/auth/register').send(userData).expect(201);

      const user = await User.findOne({ email: userData.email });
      expect(user.password).not.toBe(userData.password);
      expect(user.password).toMatch(/^\$2[aby]\$/); // Bcrypt hash pattern
    });
  });

  describe('POST /api/auth/login', () => {
    const testUser = {
      email: 'login@example.com',
      password: 'TestPassword123!',
      firstName: 'Login',
      lastName: 'Test',
      role: 'driver'
    };

    beforeEach(async () => {
      // Create a test user for login tests
      await request(app).post('/api/auth/register').send(testUser);
    });

    test('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!'
        })
        .expect(400);

      expect(response.body.message).toBe('Invalid credentials');
      expect(response.body.accessToken).toBeUndefined();
    });

    test('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'AnyPassword123!'
        })
        .expect(400);

      expect(response.body.message).toBe('Invalid credentials');
    });

    test('should reject login with missing email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: testUser.password
        })
        .expect(400);

      expect(response.body.message).toBe('Invalid credentials');
    });

    test('should reject login with missing password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email
        })
        .expect(500);
    });

    test('should handle case-sensitive email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email.toUpperCase(),
          password: testUser.password
        })
        .expect(400);

      expect(response.body.message).toBe('Invalid credentials');
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);
    });

    test('should handle empty request body', async () => {
      const response = await request(app).post('/api/auth/register').send({}).expect(500);
    });
  });

  describe('Security Requirements', () => {
    test('should not expose password in any response', async () => {
      const userData = {
        email: 'security@example.com',
        password: 'SecurePassword123!',
        firstName: 'Security',
        lastName: 'Test',
        role: 'driver'
      };

      const registerResponse = await request(app).post('/api/auth/register').send(userData);

      expect(JSON.stringify(registerResponse.body)).not.toContain(userData.password);

      const loginResponse = await request(app).post('/api/auth/login').send({
        email: userData.email,
        password: userData.password
      });

      expect(JSON.stringify(loginResponse.body)).not.toContain(userData.password);
    });
  });
});
