const { io } = require('socket.io-client');

const socket = io('http://localhost:5000'); // Connect to the server

socket.on('connect', () => {
    console.log(`Connected with ID: ${socket.id}`);
    socket.emit('join_room', 'room1');
    
    // Simulate sending a message
    socket.emit('send_message', {
        room: 'room1',
        sender: 'TestUser',
        message: 'Hello, Room!',
    });
});

socket.on('receive_message', (data) => {
    console.log(`Message received: ${data.message} from ${data.sender}`);
});
