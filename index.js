const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const UserModel = require('./UserModel');

// ✅ Connect to MongoDB
const MONGO_URI = process.env.MONGODB_URI;
mongoose.connect(MONGO_URI, {});
const db = mongoose.connection;
db.on('error', console.error.bind(console, '❌ MongoDB connection error:'));
db.once('open', () => {
  console.log('✅ Connected to MongoDB');
});

// ✅ Enable CORS
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));

// ✅ Create socket server
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ['GET', 'POST'],
  },
});

// ✅ In-memory maps to track connected users
const userSocketMap = new Map(); // userId -> socket.id
const socketUserMap = new Map(); // socket.id -> userId

io.on('connection', (socket) => {

  // 🔐 Register user with their userId
  socket.on('register', async (userId) => {
    if (!userId) return;

    userSocketMap.set(userId, socket.id);
    socketUserMap.set(socket.id, userId);

    try {
      const user = await UserModel.findById(userId);
      if (user) {
        user.status = true;
        await user.save();

        // ✅ Emit status update to all (including self)
        io.emit('status', { userId, status: true });
      }
    } catch (err) {
      console.error('❌ Error registering user:', err);
    }
  });

  // 📩 Private message handler
  socket.on('private-message', ({ toUserId, message, fromUserId }) => {
    if (!toUserId || !message) {
      socket.emit('error', '❌ Missing toUserId or message');
      return;
    }

    const targetSocketId = userSocketMap.get(toUserId);

    if (targetSocketId) {
      io.to(targetSocketId).emit('private-message', {
        from: fromUserId || socketUserMap.get(socket.id),
        message,
      });
    } else {
      socket.emit('error', `❌ User ${toUserId} is not connected`);
    }
  });

  // 📥 Handle status request
  socket.on('status', async (userId) => {
    try {
      const user = await UserModel.findById(userId);
      if (user) {
        const isOnline = userSocketMap.has(userId);
        socket.emit('status', { userId, status: isOnline });
      }
    } catch (err) {
      console.error('❌ Error checking status:', err);
    }
  });

  // 📞 Voice Call Signaling Events (WebRTC)
  socket.on('call-user', ({ to, offer }) => {
    const targetSocketId = userSocketMap.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('call-made', {
        offer,
        from: socketUserMap.get(socket.id),
      });
    }
  });

  socket.on('make-answer', ({ to, answer }) => {
    const targetSocketId = userSocketMap.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('answer-made', {
        answer,
        from: socketUserMap.get(socket.id),
      });
    }
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    const targetSocketId = userSocketMap.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('ice-candidate', {
        candidate,
        from: socketUserMap.get(socket.id),
      });
    }
  });

  // 🧹 On disconnect
  socket.on('disconnect', async () => {
    const userId = socketUserMap.get(socket.id);

    if (userId) {
      userSocketMap.delete(userId);
      socketUserMap.delete(socket.id);

      try {
        const user = await UserModel.findById(userId);
        if (user) {
          user.status = false;
          await user.save();
        }

        // ✅ Notify others of offline status
        io.emit('status', { userId, status: false });
      } catch (err) {
        console.error('❌ Error on disconnect:', err);
      }
    }
  });
});

// 🚀 Start server
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 Socket.IO server running `);
});

