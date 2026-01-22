require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const connectDB = require('./config/db');

connectDB();



const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*', // Allow all origins for now
        methods: ['GET', 'POST'],
    },
});

// Middleware
app.use(cors());
app.use(express.json());
const chatRoutes = require('./routes/chatRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
app.use('/api/chat', chatRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Routes (placeholder)
app.get('/', (req, res) => {
    res.send('Server is running!');
});

// Socket.IO connection
const ChatMessage = require('./models/ChatMessage');

io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) {
        socket.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded;
        return next();
    } catch (error) {
        return next(new Error('Invalid token'));
    }
});

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join a chat room
    socket.on('join_room', ({ roomId }) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room: ${roomId}`);
    });

    // Handle sending a message
    socket.on('send_message', async (data) => {
        const { roomId, sender, message } = data;

        // Save the message in the database
        try {
            const chatMessage = new ChatMessage({ roomId, sender, message });
            await chatMessage.save();
            console.log(`Message saved: ${message}`);

            // Broadcast the message to the room
            io.to(roomId).emit('receive_message', { sender, message, timestamp: new Date() });
        } catch (error) {
            console.error('Error saving message:', error);
        }
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });

    socket.on('typing', ({ roomId, isTyping }) => {
        if (!socket.user?.id) {
            return;
        }
        // Broadcast the typing event to everyone in the room except the sender
        socket.to(roomId).emit('typing', {
            user: socket.user.id, // Include user ID to identify who is typing
            isTyping,
        });
    });
    
    socket.on('read_message', async ({ messageId, roomId }) => {
        if (!socket.user?.id) {
            return;
        }
        const userId = socket.user.id;
    
        try {
            // Update the message to mark it as read
            await ChatMessage.updateOne(
                { _id: messageId },
                { $addToSet: { readBy: userId } } // Add userId if not already in the array
            );
    
            // Notify the room about the read receipt
            socket.to(roomId).emit('message_read', { messageId, userId });
        } catch (error) {
            console.error('Failed to mark message as read:', error);
        }
    });
});








const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
