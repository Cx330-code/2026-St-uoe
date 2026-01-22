# Roadside Assistance (RSA) - Real-Time Chat Application

A real-time chat application built with Node.js, Express, Socket.IO, and MongoDB. This application provides instant messaging capabilities with features like room-based chats, typing indicators, read receipts, and user authentication.

## Features

- **Real-time Messaging**: Instant message delivery using Socket.IO
- **Room-based Chat**: Users can join specific chat rooms for organized conversations
- **Typing Indicators**: See when other users are typing
- **Read Receipts**: Track which users have read messages
- **User Authentication**: JWT-based authentication system with refresh tokens
- **Message Persistence**: All messages are stored in MongoDB
- **CORS Enabled**: Cross-origin requests supported

## Tech Stack

- **Backend Framework**: Express.js
- **Real-time Communication**: Socket.IO
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JSON Web Tokens (JWT)
- **Environment Management**: dotenv

## Project Structure

```
rsa-sprint3/
├── src/
│   ├── index.js                 # Main application entry point
│   ├── test.js                  # Test file
│   ├── testclient.js            # Test client for Socket.IO
│   ├── config/
│   │   ├── db.js                # Database configuration
│   │   └── jwt.js               # JWT configuration
│   ├── controllers/
│   │   ├── authController.js    # Authentication logic
│   │   └── userController.js    # User management logic
│   ├── middleware/
│   │   └── authMiddleware.js    # Authentication middleware
│   ├── models/
│   │   ├── ChatMessage.js       # Chat message schema
│   │   ├── RefreshToken.js      # Refresh token schema
│   │   └── User.js              # User schema
│   ├── routes/
│   │   ├── authRoutes.js        # Authentication routes
│   │   ├── chatRoutes.js        # Chat routes
│   │   └── userRoutes.js        # User routes
│   └── utils/
│       ├── generateToken.js     # JWT token generation utility
│       ├── hashPassword.js      # Password hashing utility
│       └── responseHandler.js   # Standardized response handler
├── package.json
└── README.md
```

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (running locally or remote instance)
- npm or yarn package manager

## Installation

1. **Clone the repository**

   ```bash
   git clone <https://github.com/Cx330-code/2026-St-uoe.git>
   cd rsa-sprint3
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory with the following variables:

   ```env
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/rsa
   JWT_SECRET=your_jwt_secret_key
   JWT_REFRESH_SECRET=your_refresh_token_secret
   ```

4. **Start MongoDB**

   Make sure MongoDB is running on your local machine or configure the `MONGO_URI` to point to your MongoDB instance.

## Usage

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The server will start on `http://localhost:5000` (or the port specified in your `.env` file).

## API Endpoints

### Authentication Routes

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout user

### Chat Routes

- `GET /api/chat/messages/:roomId` - Get messages for a specific room
- `POST /api/chat/send` - Send a message (alternative to Socket.IO)

### User Routes

- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile

## Socket.IO Events

### Client to Server Events

- **`join_room`**: Join a chat room

  ```javascript
  socket.emit("join_room", { roomId: "room123" });
  ```

- **`send_message`**: Send a message to a room

  ```javascript
  socket.emit("send_message", {
    roomId: "room123",
    sender: "userId",
    message: "Hello!",
  });
  ```

- **`typing`**: Indicate typing status

  ```javascript
  socket.emit("typing", { roomId: "room123", isTyping: true });
  ```

- **`read_message`**: Mark a message as read
  ```javascript
  socket.emit("read_message", {
    messageId: "msg123",
    roomId: "room123",
  });
  ```

### Server to Client Events

- **`receive_message`**: Receive a new message

  ```javascript
  socket.on("receive_message", (data) => {
    console.log(data.sender, data.message, data.timestamp);
  });
  ```

- **`typing`**: Receive typing indicator

  ```javascript
  socket.on("typing", (data) => {
    console.log(`User ${data.user} is typing: ${data.isTyping}`);
  });
  ```

- **`message_read`**: Receive read receipt
  ```javascript
  socket.on("message_read", (data) => {
    console.log(`Message ${data.messageId} read by ${data.userId}`);
  });
  ```

## Database Schema

### ChatMessage

- `roomId`: String (required) - Chat room identifier
- `sender`: String (required) - User ID of the sender
- `message`: String (required) - Message content
- `timestamp`: Date (default: Date.now) - Message timestamp
- `readBy`: Array of Strings - User IDs who have read the message

### User

- User authentication and profile information

### RefreshToken

- JWT refresh token management

## Security Features

- Password hashing
- JWT-based authentication
- Refresh token rotation
- Protected routes with authentication middleware

## Development

### Running Tests

```bash
npm test
```

### Using Nodemon for Development

The project includes nodemon as a dev dependency for automatic server restarts during development.

```bash
npx nodemon src/index.js
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

ISC

## Author

Mark

## Support

For issues and questions, please open an issue in the repository.


