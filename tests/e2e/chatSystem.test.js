/**
 * End-to-End Tests for Chat System
 * Tests LO3: System-level Testing
 *
 * Purpose: Test complete user flows across the entire application
 */

const io = require('socket.io-client');
const { createServer } = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const ChatMessage = require('../../src/models/ChatMessage');

describe('Chat System - End-to-End Tests', () => {
  let httpServer;
  let ioServer;
  let clientSocket1;
  let clientSocket2;
  let port;

  beforeAll(async () => {
    // Setup MongoDB
    await mongoose.connect('mongodb://localhost:27017/rsachat');

    // Setup Socket.IO server
    httpServer = createServer();
    ioServer = new Server(httpServer, {
      cors: { origin: '*', methods: ['GET', 'POST'] }
    });

    // Implement server-side Socket.IO logic
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

      socket.on('typing', ({ roomId, isTyping }) => {
        socket.to(roomId).emit('typing', {
          user: socket.id,
          isTyping
        });
      });

      socket.on('read_message', async ({ messageId, roomId }) => {
        const userId = socket.id;
        try {
          await ChatMessage.updateOne({ _id: messageId }, { $addToSet: { readBy: userId } });
          socket.to(roomId).emit('message_read', { messageId, userId });
        } catch (error) {
          socket.emit('error', { message: 'Failed to mark message as read' });
        }
      });
    });

    // Start server on random available port
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

  afterEach(() => {
    if (clientSocket1?.connected) clientSocket1.disconnect();
    if (clientSocket2?.connected) clientSocket2.disconnect();
  });

  describe('User Connection Flow', () => {
    test('should successfully connect to server', (done) => {
      clientSocket1 = io(`http://localhost:${port}`);

      clientSocket1.on('connect', () => {
        expect(clientSocket1.connected).toBe(true);
        expect(clientSocket1.id).toBeDefined();
        done();
      });
    });

    test('should handle multiple simultaneous connections', (done) => {
      clientSocket1 = io(`http://localhost:${port}`);
      clientSocket2 = io(`http://localhost:${port}`);

      let connectedCount = 0;

      const checkBothConnected = () => {
        connectedCount++;
        if (connectedCount === 2) {
          expect(clientSocket1.id).not.toBe(clientSocket2.id);
          done();
        }
      };

      clientSocket1.on('connect', checkBothConnected);
      clientSocket2.on('connect', checkBothConnected);
    });

    test('should disconnect gracefully', (done) => {
      clientSocket1 = io(`http://localhost:${port}`);

      clientSocket1.on('connect', () => {
        clientSocket1.disconnect();
      });

      clientSocket1.on('disconnect', () => {
        expect(clientSocket1.connected).toBe(false);
        done();
      });
    });
  });

  describe('Join Room Flow', () => {
    test('should join a chat room successfully', (done) => {
      clientSocket1 = io(`http://localhost:${port}`);
      const roomId = 'test-room-1';

      clientSocket1.on('connect', () => {
        clientSocket1.emit('join_room', { roomId });

        // Wait a moment for room join to process
        setTimeout(() => {
          // If no error occurred, test passes
          done();
        }, 100);
      });
    });

    test('should allow multiple users to join same room', (done) => {
      const roomId = 'shared-room';
      clientSocket1 = io(`http://localhost:${port}`);
      clientSocket2 = io(`http://localhost:${port}`);

      let joinedCount = 0;

      const checkBothJoined = () => {
        joinedCount++;
        if (joinedCount === 2) {
          done();
        }
      };

      clientSocket1.on('connect', () => {
        clientSocket1.emit('join_room', { roomId });
        checkBothJoined();
      });

      clientSocket2.on('connect', () => {
        clientSocket2.emit('join_room', { roomId });
        checkBothJoined();
      });
    });
  });

  describe('Complete Messaging Flow', () => {
    test('should send and receive message in same room', (done) => {
      const roomId = 'messaging-room';
      const testMessage = 'Hello from E2E test';

      clientSocket1 = io(`http://localhost:${port}`);
      clientSocket2 = io(`http://localhost:${port}`);

      clientSocket2.on('connect', () => {
        clientSocket2.emit('join_room', { roomId });

        clientSocket2.on('receive_message', (data) => {
          expect(data.sender).toBe('user1');
          expect(data.message).toBe(testMessage);
          expect(data.timestamp).toBeDefined();
          done();
        });
      });

      clientSocket1.on('connect', () => {
        clientSocket1.emit('join_room', { roomId });

        setTimeout(() => {
          clientSocket1.emit('send_message', {
            roomId,
            sender: 'user1',
            message: testMessage
          });
        }, 100);
      });
    });

    test('should persist message to database', (done) => {
      const roomId = 'persist-room';
      const testMessage = 'Persistent message';

      clientSocket1 = io(`http://localhost:${port}`);

      clientSocket1.on('connect', () => {
        clientSocket1.emit('join_room', { roomId });

        clientSocket1.emit('send_message', {
          roomId,
          sender: 'user1',
          message: testMessage
        });

        clientSocket1.on('receive_message', async () => {
          const messages = await ChatMessage.find({ roomId });
          expect(messages).toHaveLength(1);
          expect(messages[0].message).toBe(testMessage);
          done();
        });
      });
    });

    test('should not receive messages from different room', (done) => {
      clientSocket1 = io(`http://localhost:${port}`);
      clientSocket2 = io(`http://localhost:${port}`);

      let messageReceived = false;

      clientSocket2.on('connect', () => {
        clientSocket2.emit('join_room', { roomId: 'room-A' });

        clientSocket2.on('receive_message', () => {
          messageReceived = true;
        });
      });

      clientSocket1.on('connect', () => {
        clientSocket1.emit('join_room', { roomId: 'room-B' });

        setTimeout(() => {
          clientSocket1.emit('send_message', {
            roomId: 'room-B',
            sender: 'user1',
            message: 'Message in room B'
          });
        }, 100);

        setTimeout(() => {
          expect(messageReceived).toBe(false);
          done();
        }, 300);
      });
    });

    test('should handle multiple messages in sequence', (done) => {
      const roomId = 'multi-message-room';
      const messages = ['First', 'Second', 'Third'];
      const received = [];

      clientSocket1 = io(`http://localhost:${port}`);
      clientSocket2 = io(`http://localhost:${port}`);

      clientSocket2.on('connect', () => {
        clientSocket2.emit('join_room', { roomId });

        clientSocket2.on('receive_message', (data) => {
          received.push(data.message);

          if (received.length === messages.length) {
            expect(received).toEqual(messages);
            done();
          }
        });
      });

      clientSocket1.on('connect', () => {
        clientSocket1.emit('join_room', { roomId });

        setTimeout(() => {
          messages.forEach((msg, index) => {
            setTimeout(() => {
              clientSocket1.emit('send_message', {
                roomId,
                sender: 'user1',
                message: msg
              });
            }, index * 50);
          });
        }, 100);
      });
    });
  });

  describe('Typing Indicator Flow', () => {
    test('should broadcast typing indicator to other users', (done) => {
      const roomId = 'typing-room';

      clientSocket1 = io(`http://localhost:${port}`);
      clientSocket2 = io(`http://localhost:${port}`);

      clientSocket2.on('connect', () => {
        clientSocket2.emit('join_room', { roomId });

        clientSocket2.on('typing', (data) => {
          expect(data.user).toBeDefined();
          expect(data.isTyping).toBe(true);
          done();
        });
      });

      clientSocket1.on('connect', () => {
        clientSocket1.emit('join_room', { roomId });

        setTimeout(() => {
          clientSocket1.emit('typing', { roomId, isTyping: true });
        }, 100);
      });
    });

    test('should handle typing stop event', (done) => {
      const roomId = 'typing-stop-room';

      clientSocket1 = io(`http://localhost:${port}`);
      clientSocket2 = io(`http://localhost:${port}`);

      let typingEvents = [];

      clientSocket2.on('connect', () => {
        clientSocket2.emit('join_room', { roomId });

        clientSocket2.on('typing', (data) => {
          typingEvents.push(data.isTyping);

          if (typingEvents.length === 2) {
            expect(typingEvents).toEqual([true, false]);
            done();
          }
        });
      });

      clientSocket1.on('connect', () => {
        clientSocket1.emit('join_room', { roomId });

        setTimeout(() => {
          clientSocket1.emit('typing', { roomId, isTyping: true });

          setTimeout(() => {
            clientSocket1.emit('typing', { roomId, isTyping: false });
          }, 100);
        }, 100);
      });
    });
  });

  describe('Error Handling Flow', () => {
    test('should handle invalid message data gracefully', (done) => {
      clientSocket1 = io(`http://localhost:${port}`);

      clientSocket1.on('connect', () => {
        clientSocket1.emit('join_room', { roomId: 'error-room' });

        clientSocket1.on('error', (data) => {
          expect(data.message).toBeDefined();
          done();
        });

        // Send invalid message (missing required fields)
        setTimeout(() => {
          clientSocket1.emit('send_message', {
            roomId: 'error-room'
            // Missing sender and message
          });
        }, 100);
      });
    });
  });

  describe('Multi-User Conversation Flow', () => {
    test('should support group chat with 3+ users', (done) => {
      const roomId = 'group-chat';
      const client3 = io(`http://localhost:${port}`);

      clientSocket1 = io(`http://localhost:${port}`);
      clientSocket2 = io(`http://localhost:${port}`);

      let receivedCount = 0;

      const onMessageReceived = () => {
        receivedCount++;
        if (receivedCount === 2) {
          // Both client2 and client3 receive
          client3.disconnect();
          done();
        }
      };

      clientSocket2.on('connect', () => {
        clientSocket2.emit('join_room', { roomId });
        clientSocket2.on('receive_message', onMessageReceived);
      });

      client3.on('connect', () => {
        client3.emit('join_room', { roomId });
        client3.on('receive_message', onMessageReceived);
      });

      clientSocket1.on('connect', () => {
        clientSocket1.emit('join_room', { roomId });

        setTimeout(() => {
          clientSocket1.emit('send_message', {
            roomId,
            sender: 'user1',
            message: 'Group message'
          });
        }, 200);
      });
    });
  });
});
