/**
 * Performance & Load Tests
 * Tests LO3 & LO4: Non-functional Testing - Performance
 *
 * Purpose: Validate performance requirements and system behavior under load
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

describe('Performance Tests', () => {
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

  describe('Concurrent User Performance', () => {
    test('should handle 50 concurrent registrations', async () => {
      const startTime = Date.now();
      const promises = [];

      for (let i = 0; i < 50; i++) {
        promises.push(
          request(app)
            .post('/api/auth/register')
            .send({
              email: `concurrent${i}@test.com`,
              password: 'Password123',
              firstName: 'Concurrent',
              lastName: `User${i}`,
              role: 'driver'
            })
        );
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(results.every((r) => r.status === 201)).toBe(true);
      expect(duration).toBeLessThan(5000); // 5 seconds for 50 users

      console.log(
        `50 concurrent registrations: ${duration}ms (${(duration / 50).toFixed(2)}ms avg)`
      );
    });

    test('should handle rapid sequential requests from same user', async () => {
      const roomId = 'rapid-room';
      const requestCount = 50;

      const startTime = Date.now();

      for (let i = 0; i < requestCount; i++) {
        await request(app).get(`/api/chat/${roomId}`).expect(200);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(
        `50 sequential requests: ${duration}ms (${(duration / requestCount).toFixed(2)}ms avg)`
      );
      expect(duration).toBeLessThan(10000); // 10 seconds for 50 requests
    });
  });

  describe('Database Performance Under Load', () => {});

  describe('Memory Performance', () => {
    test('should not leak memory with repeated operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        await request(app)
          .post('/api/auth/register')
          .send({
            email: `memory${i}@test.com`,
            password: 'Password123',
            firstName: 'Memory',
            lastName: `Test${i}`,
            role: 'driver'
          });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseMB = (memoryIncrease / 1024 / 1024).toFixed(2);

      console.log(`Memory increase after ${iterations} operations: ${memoryIncreaseMB}MB`);

      // Memory increase should be reasonable (less than 50MB for 100 operations)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Throughput Performance', () => {
    test('should measure requests per second capacity', async () => {
      const roomId = 'throughput-room';
      const duration = 2000; // 2 seconds
      const startTime = Date.now();
      let requestCount = 0;

      while (Date.now() - startTime < duration) {
        await request(app).get(`/api/chat/${roomId}`).expect(200);
        requestCount++;
      }

      const actualDuration = Date.now() - startTime;
      const requestsPerSecond = (requestCount / (actualDuration / 1000)).toFixed(2);

      console.log(
        `Throughput: ${requestsPerSecond} requests/second (${requestCount} requests in ${actualDuration}ms)`
      );

      // Should handle at least 20 requests per second
      expect(parseFloat(requestsPerSecond)).toBeGreaterThan(20);
    });
  });
});

describe('Load Tests', () => {
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
        const chatMessage = new ChatMessage({ roomId, sender, message });
        await chatMessage.save();
        ioServer.to(roomId).emit('receive_message', { sender, message, timestamp: new Date() });
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

  describe('Socket.IO Load Testing', () => {
    test('should handle 20 simultaneous connections', async () => {
      const clientCount = 20;
      const clients = [];

      const startTime = Date.now();

      // Create connections
      const connectionPromises = Array.from({ length: clientCount }, () => {
        return new Promise((resolve) => {
          const client = io(`http://localhost:${port}`);
          clients.push(client);
          client.on('connect', resolve);
        });
      });

      await Promise.all(connectionPromises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(clients).toHaveLength(clientCount);
      expect(clients.every((c) => c.connected)).toBe(true);

      console.log(`${clientCount} connections established in ${duration}ms`);

      // Cleanup
      clients.forEach((c) => c.disconnect());
    }, 15000);

    test('should measure message delivery latency', async () => {
      const client1 = io(`http://localhost:${port}`);
      const client2 = io(`http://localhost:${port}`);
      const roomId = 'latency-room';
      const latencies = [];

      await new Promise((resolve) => client1.on('connect', resolve));
      await new Promise((resolve) => client2.on('connect', resolve));

      client1.emit('join_room', { roomId });
      client2.emit('join_room', { roomId });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Measure latency for 20 messages
      for (let i = 0; i < 20; i++) {
        const sendTime = Date.now();

        await new Promise((resolve) => {
          client2.once('receive_message', () => {
            const receiveTime = Date.now();
            latencies.push(receiveTime - sendTime);
            resolve();
          });

          client1.emit('send_message', {
            roomId,
            sender: 'user1',
            message: `Latency test ${i}`
          });
        });
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const minLatency = Math.min(...latencies);

      console.log(
        `Message latency - Avg: ${avgLatency.toFixed(2)}ms, Min: ${minLatency}ms, Max: ${maxLatency}ms`
      );

      // Average latency should be less than 100ms
      expect(avgLatency).toBeLessThan(100);

      client1.disconnect();
      client2.disconnect();
    }, 15000);
  });
});
