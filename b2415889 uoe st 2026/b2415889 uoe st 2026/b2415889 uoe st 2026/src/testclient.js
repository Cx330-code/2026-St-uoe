const { io } = require('socket.io-client');

const socket = io('http://localhost:5000'); // Connect to your server

socket.on('connect', () => {
    console.log(`Connected with ID: ${socket.id}`);

    // Join a specific room (replace with your service-request-id)
    const roomId = 'test-room';
    socket.emit('join_room', { roomId });

    // Send a message
    socket.emit('send_message', {
        roomId,
        sender: 'TestUser',
        message: 'Hello, this is a test message! we are testing the chat feature. For the presentation',
    });
});

// Receive messages
socket.on('receive_message', (data) => {
    console.log('Received message:', data);
});
