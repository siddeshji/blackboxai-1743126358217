require('dotenv').config();
const express = require('express');
const { createServer } = require('node:http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// Socket.io middleware for authentication
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return next(new Error('Authentication error'));
    }

    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.user.username);

  // Update user online status
  User.findByIdAndUpdate(socket.user.id, {
    isOnline: true,
    lastSeen: null
  });

  // Handle chat events
  require('./socket/chatHandlers')(io, socket);

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.user.username);
    
    // Update user offline status
    await User.findByIdAndUpdate(socket.user.id, {
      isOnline: false,
      lastSeen: Date.now()
    });
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});