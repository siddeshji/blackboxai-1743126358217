const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    Get all chats for a user
// @route   GET /api/chat
// @access  Private
exports.getUserChats = asyncHandler(async (req, res, next) => {
  const chats = await Chat.find({
    participants: req.user.id
  })
  .populate('participants', 'username isOnline lastSeen')
  .populate('lastMessage')
  .sort('-updatedAt');

  res.status(200).json({
    success: true,
    data: chats
  });
});

// @desc    Get messages in a chat
// @route   GET /api/chat/:chatId/messages
// @access  Private
exports.getChatMessages = asyncHandler(async (req, res, next) => {
  // Verify user is a participant in the chat
  const chat = await Chat.findOne({
    _id: req.params.chatId,
    participants: req.user.id
  });

  if (!chat) {
    return next(new ErrorResponse('Not authorized to access this chat', 401));
  }

  const messages = await Message.find({
    chat: req.params.chatId
  })
  .sort('createdAt')
  .populate('sender', 'username');

  res.status(200).json({
    success: true,
    data: messages
  });
});

// @desc    Create new chat
// @route   POST /api/chat
// @access  Private
exports.createChat = asyncHandler(async (req, res, next) => {
  const { participants } = req.body;

  // Add current user to participants if not already included
  if (!participants.includes(req.user.id)) {
    participants.push(req.user.id);
  }

  // Check if private chat already exists
  if (participants.length === 2) {
    const existingChat = await Chat.findOne({
      participants: { $all: participants, $size: 2 }
    });

    if (existingChat) {
      return res.status(200).json({
        success: true,
        data: existingChat
      });
    }
  }

  const chat = await Chat.create({
    participants,
    isGroup: participants.length > 2
  });

  res.status(201).json({
    success: true,
    data: chat
  });
});

// @desc    Delete chat
// @route   DELETE /api/chat/:chatId
// @access  Private
exports.deleteChat = asyncHandler(async (req, res, next) => {
  const chat = await Chat.findOneAndDelete({
    _id: req.params.chatId,
    participants: req.user.id
  });

  if (!chat) {
    return next(new ErrorResponse('Chat not found', 404));
  }

  // Delete all messages in the chat
  await Message.deleteMany({ chat: req.params.chatId });

  res.status(200).json({
    success: true,
    data: {}
  });
});