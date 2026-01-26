/**
 * Integration Tests for Chat Routes
 * Tests LO3: Integration Testing
 *
 * Purpose: Test chat endpoints with database integration
 */

const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const chatRoutes = require("../../src/routes/chatRoutes");
const ChatMessage = require("../../src/models/ChatMessage");

describe("Chat Routes - Integration Tests", () => {
  let app;
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri);

    app = express();
    app.use(express.json());
    app.use("/api/chat", chatRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await ChatMessage.deleteMany({});
  });

  describe("GET /api/chat/:roomId", () => {
    test("should retrieve empty array for room with no messages", async () => {
      const response = await request(app)
        .get("/api/chat/room-empty")
        .expect(200);

      expect(response.body).toEqual([]);
    });

    test("should retrieve all messages for a specific room", async () => {
      const roomId = "room-123";

      // Create test messages
      const messages = [
        { roomId, sender: "user1", message: "Hello" },
        { roomId, sender: "user2", message: "Hi there" },
        { roomId, sender: "user1", message: "How are you?" },
      ];

      await ChatMessage.insertMany(messages);

      const response = await request(app)
        .get(`/api/chat/${roomId}`)
        .expect(200);

      expect(response.body).toHaveLength(3);
      expect(response.body[0].message).toBe("Hello");
      expect(response.body[1].message).toBe("Hi there");
      expect(response.body[2].message).toBe("How are you?");
    });

    test("should return messages in chronological order", async () => {
      const roomId = "room-chronological";

      const msg1 = await ChatMessage.create({
        roomId,
        sender: "user1",
        message: "First",
        timestamp: new Date("2026-01-01T10:00:00"),
      });

      const msg2 = await ChatMessage.create({
        roomId,
        sender: "user2",
        message: "Second",
        timestamp: new Date("2026-01-01T10:05:00"),
      });

      const msg3 = await ChatMessage.create({
        roomId,
        sender: "user1",
        message: "Third",
        timestamp: new Date("2026-01-01T10:10:00"),
      });

      const response = await request(app)
        .get(`/api/chat/${roomId}`)
        .expect(200);

      expect(response.body[0].message).toBe("First");
      expect(response.body[1].message).toBe("Second");
      expect(response.body[2].message).toBe("Third");
    });

    test("should only return messages from specified room", async () => {
      await ChatMessage.insertMany([
        { roomId: "room-A", sender: "user1", message: "Message in A" },
        { roomId: "room-B", sender: "user2", message: "Message in B" },
        { roomId: "room-A", sender: "user3", message: "Another in A" },
      ]);

      const response = await request(app).get("/api/chat/room-A").expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.every((msg) => msg.roomId === "room-A")).toBe(true);
    });

    test("should handle room IDs with special characters", async () => {
      const specialRoomId = "room-with-dashes_and_underscores";

      await ChatMessage.create({
        roomId: specialRoomId,
        sender: "user1",
        message: "Test message",
      });

      const response = await request(app)
        .get(`/api/chat/${specialRoomId}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].roomId).toBe(specialRoomId);
    });

    test("should include all message fields in response", async () => {
      const roomId = "room-fields";

      await ChatMessage.create({
        roomId,
        sender: "user123",
        message: "Complete message",
      });

      const response = await request(app)
        .get(`/api/chat/${roomId}`)
        .expect(200);

      expect(response.body[0]).toHaveProperty("_id");
      expect(response.body[0]).toHaveProperty("roomId");
      expect(response.body[0]).toHaveProperty("sender");
      expect(response.body[0]).toHaveProperty("message");
      expect(response.body[0]).toHaveProperty("timestamp");
    });

    test("should handle large message history", async () => {
      const roomId = "room-large";
      const messageCount = 100;

      const messages = Array.from({ length: messageCount }, (_, i) => ({
        roomId,
        sender: `user${i % 10}`,
        message: `Message ${i}`,
        timestamp: new Date(Date.now() + i * 1000),
      }));

      await ChatMessage.insertMany(messages);

      const response = await request(app)
        .get(`/api/chat/${roomId}`)
        .expect(200);

      expect(response.body).toHaveLength(messageCount);
    });

    test("should handle database errors gracefully", async () => {
      // Close database connection to simulate error
      await mongoose.connection.close();

      const response = await request(app).get("/api/chat/any-room").expect(500);

      expect(response.body.error).toBe("Failed to fetch chat history");

      // Reconnect for other tests
      const mongoUri = mongoServer.getUri();
      await mongoose.connect(mongoUri);
    });
  });

  describe("Message Data Integrity", () => {
    test("should preserve message content exactly", async () => {
      const roomId = "room-integrity";
      const complexMessage =
        "Message with\nnewlines\tand\ttabs and \"quotes\" and 'apostrophes'";

      await ChatMessage.create({
        roomId,
        sender: "user1",
        message: complexMessage,
      });

      const response = await request(app)
        .get(`/api/chat/${roomId}`)
        .expect(200);

      expect(response.body[0].message).toBe(complexMessage);
    });

    test("should preserve unicode characters", async () => {
      const roomId = "room-unicode";
      const unicodeMessage = "Hello 世界 🌍 مرحبا";

      await ChatMessage.create({
        roomId,
        sender: "user1",
        message: unicodeMessage,
      });

      const response = await request(app)
        .get(`/api/chat/${roomId}`)
        .expect(200);

      expect(response.body[0].message).toBe(unicodeMessage);
    });

    test("should handle empty messages", async () => {
      const roomId = "room-empty-msg";

      await ChatMessage.create({
        roomId,
        sender: "user1",
        message: "",
      });

      const response = await request(app)
        .get(`/api/chat/${roomId}`)
        .expect(200);

      expect(response.body[0].message).toBe("");
    });

    test("should handle very long messages", async () => {
      const roomId = "room-long";
      const longMessage = "A".repeat(10000);

      await ChatMessage.create({
        roomId,
        sender: "user1",
        message: longMessage,
      });

      const response = await request(app)
        .get(`/api/chat/${roomId}`)
        .expect(200);

      expect(response.body[0].message).toBe(longMessage);
      expect(response.body[0].message.length).toBe(10000);
    });
  });

  describe("Timestamp Handling", () => {
    test("should automatically set timestamp if not provided", async () => {
      const roomId = "room-auto-timestamp";
      const beforeCreation = Date.now();

      await ChatMessage.create({
        roomId,
        sender: "user1",
        message: "Auto timestamp test",
      });

      const afterCreation = Date.now();

      const response = await request(app)
        .get(`/api/chat/${roomId}`)
        .expect(200);

      const messageTimestamp = new Date(response.body[0].timestamp).getTime();
      expect(messageTimestamp).toBeGreaterThanOrEqual(beforeCreation);
      expect(messageTimestamp).toBeLessThanOrEqual(afterCreation);
    });

    test("should respect custom timestamps", async () => {
      const roomId = "room-custom-timestamp";
      const customDate = new Date("2025-01-01T12:00:00Z");

      await ChatMessage.create({
        roomId,
        sender: "user1",
        message: "Custom timestamp",
        timestamp: customDate,
      });

      const response = await request(app)
        .get(`/api/chat/${roomId}`)
        .expect(200);

      expect(new Date(response.body[0].timestamp)).toEqual(customDate);
    });
  });

  describe("Performance", () => {
    test("should retrieve messages quickly even with many in database", async () => {
      // Create messages in multiple rooms
      const rooms = ["room-1", "room-2", "room-3"];
      const messagesPerRoom = 50;

      for (const room of rooms) {
        const messages = Array.from({ length: messagesPerRoom }, (_, i) => ({
          roomId: room,
          sender: `user${i}`,
          message: `Message ${i}`,
        }));
        await ChatMessage.insertMany(messages);
      }

      const startTime = Date.now();

      await request(app).get("/api/chat/room-2").expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 1 second
      expect(duration).toBeLessThan(1000);
    });
  });
});
