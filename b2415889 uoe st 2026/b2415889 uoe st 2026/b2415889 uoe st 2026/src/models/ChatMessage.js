const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
    roomId: { type: String, required: true }, // Service request ID
    sender: { type: String, required: true }, // User ID (driver or mechanic)
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    readBy: { type: [String], default: [] }, // Array of user IDs who read the message
});

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
