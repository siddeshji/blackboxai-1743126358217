const express = require('express');
const router = express.Router();
const {
  getUserChats,
  getChatMessages,
  createChat,
  deleteChat
} = require('../controllers/chat');
const { protect } = require('../middleware/auth');
const Message = require('../models/Message');

// Get all chats for user
router.route('/')
  .get(protect, getUserChats)
  .post(protect, createChat);

// Get messages for specific chat
router.route('/:chatId/messages')
  .get(protect, getChatMessages);

// Get message read status
router.route('/messages/:messageId')
  .get(protect, async (req, res, next) => {
    try {
      const message = await Message.findById(req.params.messageId)
        .populate('readBy.user', 'username');
      
      if (!message) {
        return next(new ErrorResponse('Message not found', 404));
      }

      // Verify user has access to this message
      const chat = await Chat.findOne({
        _id: message.chat,
        participants: req.user.id
      });

      if (!chat) {
        return next(new ErrorResponse('Not authorized', 401));
      }

      res.status(200).json({
        success: true,
        data: message
      });
    } catch (err) {
      next(err);
    }
  });

// Delete chat
router.route('/:chatId')
  .delete(protect, deleteChat);

module.exports = router;