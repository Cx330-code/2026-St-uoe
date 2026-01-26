const express = require('express');
const ChatMessage = require('../models/ChatMessage');
const router = express.Router();

// Fetch chat history for a room
router.get('/:roomId', async (req, res) => {
    const { roomId } = req.params;
    try {
        const messages = await ChatMessage.find({ roomId }).sort({ timestamp: 1 });
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch chat history' });
    }
});

module.exports = router;
