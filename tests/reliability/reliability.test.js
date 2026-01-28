/**
 * Reliability Tests
 * Tests LO3 & LO4: Non-functional Testing - Reliability
 *
 * Purpose: Validate system reliability, error handling, and recovery
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const io = require('socket.io-client');
const { createServer } = require('http');
const { Server } = require('socket.io');
const ChatMessage = require('../../src/models/ChatMessage');
const authRoutes = require('../../src/routes/authRoutes');
const chatRoutes = require('../../src/routes/chatRoutes');

describe('Reliability Tests', () => {
  let app;

  beforeAll(async () => {
    // Connect to local MongoDB
    await mongoose.connect('mongodb://localhost:27017/rsachat');

    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use('/api/chat', chatRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe('Database Failure Recovery', () => {
    test('should handle database disconnection gracefully', async () => {
      // Close database connection
      await mongoose.connection.close();

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'dbfail@test.com',
          password: 'Password123',
          firstName: 'DB',
          lastName: 'Fail',
          role: 'driver'
        })
        .expect(500);

      expect(response.body.message).toBe('Server error');

      // Reconnect
      await mongoose.connect('mongodb://localhost:27017/rsachat');
    });

    test('should recover after database reconnection', async () => {
      // Ensure we're connected
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect('mongodb://localhost:27017/rsachat');
      }

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'recovery@test.com',
          password: 'Password123',
          firstName: 'Recovery',
          lastName: 'Test',
          role: 'driver'
        })
        .expect(201);

      expect(response.body.message).toBe('User registered successfully');
    });

    test('should handle chat retrieval when database is unavailable', async () => {
      await mongoose.connection.close();

      const response = await request(app).get('/api/chat/any-room').expect(500);

      expect(response.body.error).toBe('Failed to fetch chat history');

      await mongoose.connect('mongodb://localhost:27017/rsachat');
    });
  });

  describe('Data Consistency', () => {
    test('should prevent duplicate message IDs', async () => {
      const roomId = 'duplicate-room';

      const msg1 = await ChatMessage.create({
        roomId,
        sender: 'user1',
        message: 'First message'
      });

      const msg2 = await ChatMessage.create({
        roomId,
        sender: 'user2',
        message: 'Second message'
      });

      expect(msg1._id).not.toEqual(msg2._id);
      expect(msg1._id.toString()).not.toBe(msg2._id.toString());
    });
  });

  describe('Error Handling Robustness', () => {
    test('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('{ invalid json here }')
        .expect(400);
    });

    test('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'incomplete@test.com'
          // Missing other required fields
        })
        .expect(500);

      expect(response.body.message).toBe('Server error');
    });

    test('should handle empty request body', async () => {
      const response = await request(app).post('/api/auth/login').send({}).expect(400);
    });

    test('should handle null values in request', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: null,
          password: null,
          firstName: null,
          lastName: null,
          role: null
        })
        .expect(500);
    });

    test('should handle undefined values gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: undefined,
          password: undefined
        })
        .expect(400);
    });
  });

  describe('State Recovery', () => {
    test('should maintain service after multiple failed requests', async () => {
      // Send several failing requests
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'wrong@test.com', password: 'wrong' })
          .expect(400);
      }

      // Service should still work
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'stillworks@test.com',
          password: 'Password123',
          firstName: 'Still',
          lastName: 'Works',
          role: 'driver'
        })
        .expect(201);
    });

    test('should handle alternating success and failure', async () => {
      const results = [];

      for (let i = 0; i < 10; i++) {
        if (i % 2 === 0) {
          // Success
          const response = await request(app)
            .post('/api/auth/register')
            .send({
              email: `alternating${i}@test.com`,
              password: 'Password123',
              firstName: 'Alt',
              lastName: `User${i}`,
              role: 'driver'
            });
          results.push(response.status);
        } else {
          // Failure
          const response = await request(app)
            .post('/api/auth/login')
            .send({ email: 'notexist@test.com', password: 'wrong' });
          results.push(response.status);
        }
      }

      // Verify pattern
      expect(results[0]).toBe(201);
      expect(results[1]).toBe(400);
      expect(results[2]).toBe(201);
    });
  });

  describe('Timeout Handling', () => {
    test('should complete database operations within timeout', async () => {
      const timeout = 5000; // 5 seconds

      const promise = request(app)
        .post('/api/auth/register')
        .send({
          email: 'timeout@test.com',
          password: 'Password123',
          firstName: 'Timeout',
          lastName: 'Test',
          role: 'driver'
        })
        .timeout(timeout);

      await expect(promise).resolves.toBeDefined();
    });
  });

  describe('Resource Cleanup', () => {
    test('should not leak database connections', async () => {
      const initialConnections = mongoose.connection.readyState;

      // Perform multiple operations
      for (let i = 0; i < 20; i++) {
        await request(app).get('/api/chat/cleanup-room').expect(200);
      }

      const finalConnections = mongoose.connection.readyState;
      expect(finalConnections).toBe(initialConnections);
    });
  });
});

describe('Socket.IO Reliability Tests', () => {
  let httpServer;
  let ioServer;
  let port;

  beforeAll(async () => {
    // Connect to local MongoDB instance
    await mongoose.connect('mongodb://localhost:27017/rsachat');

    httpServer = createServer();
    ioServer = new Server(httpServer, {
      cors: { origin: '*', methods: ['GET', 'POST'] }
    });

    ioServer.on('connection', (socket) => {
      socket.on('join_room', ({ roomId }) => {
        socket.join(roomId);
      });

      socket.on('send_message', async (data) => {
        const { roomId, sender, message } = data;
        try {
          const chatMessage = new ChatMessage({ roomId, sender, message });
          await chatMessage.save();
          ioServer.to(roomId).emit('receive_message', {
            sender,
            message,
            timestamp: new Date()
          });
        } catch (error) {
          socket.emit('error', { message: 'Failed to send message' });
        }
      });
    });

    await new Promise((resolve) => {
      httpServer.listen(() => {
        port = httpServer.address().port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (ioServer) ioServer.close();
    if (httpServer) httpServer.close();
  });

  beforeEach(async () => {
    await ChatMessage.deleteMany({});
  });

  describe('Connection Reliability', () => {
    test('should handle client disconnect and reconnect', async () => {
      const client = io(`http://localhost:${port}`);

      await new Promise((resolve) => client.on('connect', resolve));
      expect(client.connected).toBe(true);

      // Disconnect
      client.disconnect();
      expect(client.connected).toBe(false);

      // Reconnect
      client.connect();
      await new Promise((resolve) => client.on('connect', resolve));
      expect(client.connected).toBe(true);

      client.disconnect();
    });

    test('should handle rapid connect/disconnect cycles', async () => {
      const client = io(`http://localhost:${port}`);

      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => client.on('connect', resolve));
        expect(client.connected).toBe(true);

        client.disconnect();
        expect(client.connected).toBe(false);

        client.connect();
      }

      client.disconnect();
    });

    test('should maintain room membership after reconnection', async () => {
      const client = io(`http://localhost:${port}`);
      const roomId = 'persistent-room';

      await new Promise((resolve) => client.on('connect', resolve));
      client.emit('join_room', { roomId });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Disconnect and reconnect
      client.disconnect();
      client.connect();
      await new Promise((resolve) => client.on('connect', resolve));

      // Need to rejoin room after reconnection
      client.emit('join_room', { roomId });

      await new Promise((resolve) => setTimeout(resolve, 100));

      client.disconnect();
    });
  });

  describe('Message Delivery Reliability', () => {
    test('should persist messages even if recipient is disconnected', async () => {
      const sender = io(`http://localhost:${port}`);
      const roomId = 'offline-room';

      await new Promise((resolve) => sender.on('connect', resolve));
      sender.emit('join_room', { roomId });

      // Send message (no receiver connected)
      sender.emit('send_message', {
        roomId,
        sender: 'user1',
        message: 'Message to offline user'
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify message was saved
      const messages = await ChatMessage.find({ roomId });
      expect(messages).toHaveLength(1);
      expect(messages[0].message).toBe('Message to offline user');

      sender.disconnect();
    });

    test('should deliver message to newly connected user', async () => {
      const sender = io(`http://localhost:${port}`);
      const roomId = 'late-join-room';

      await new Promise((resolve) => sender.on('connect', resolve));
      sender.emit('join_room', { roomId });

      // Send message
      sender.emit('send_message', {
        roomId,
        sender: 'user1',
        message: 'Early message'
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      // New user joins
      const lateUser = io(`http://localhost:${port}`);
      await new Promise((resolve) => lateUser.on('connect', resolve));

      // They can retrieve history
      const messages = await ChatMessage.find({ roomId });
      expect(messages).toHaveLength(1);
      expect(messages[0].message).toBe('Early message');

      sender.disconnect();
      lateUser.disconnect();
    });

    test('should handle message sending during database failure', async () => {
      const client = io(`http://localhost:${port}`);
      const roomId = 'db-fail-room';

      await new Promise((resolve) => client.on('connect', resolve));
      client.emit('join_room', { roomId });

      // Close database
      await mongoose.connection.close();

      // Try to send message
      let errorReceived = false;
      client.on('error', () => {
        errorReceived = true;
      });

      client.emit('send_message', {
        roomId,
        sender: 'user1',
        message: 'Message during DB failure'
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(errorReceived).toBe(true);

      // Reconnect database
      await mongoose.connect('mongodb://localhost:27017/rsachat');

      client.disconnect();
    });
  });

  describe('Error Recovery', () => {
    test('should continue operating after handling errors', async () => {
      const client = io(`http://localhost:${port}`);
      const roomId = 'error-recovery-room';

      await new Promise((resolve) => client.on('connect', resolve));
      client.emit('join_room', { roomId });

      // Send invalid message to trigger error
      client.emit('send_message', {
        roomId
        // Missing required fields
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should still work after error
      let messageReceived = false;
      client.on('receive_message', () => {
        messageReceived = true;
      });

      client.emit('send_message', {
        roomId,
        sender: 'user1',
        message: 'Valid message after error'
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(messageReceived).toBe(true);

      client.disconnect();
    });
  });
});
