require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

const corsOptions = {
  origin: process.env.FRONTEND_URL || "*",
  methods: ["GET", "POST"]
};

app.use(cors(corsOptions));

const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions
});

// Room state: Map<roomId, { players: Map<socketId, {color, id}> }>
const rooms = new Map();
let globalOnlineCount = 0;

const emitGlobalStats = () => {
  io.emit('statsUpdate', {
    onlinePlayers: globalOnlineCount,
    activeRooms: rooms.size
  });
};

io.on('connection', (socket) => {
  globalOnlineCount++;
  console.log('User connected:', socket.id);
  emitGlobalStats();

  socket.on('joinRoom', ({ roomId, playerName }) => {
    if (!roomId) return;

    let room = rooms.get(roomId);
    
    // Create room if it doesn't exist
    if (!room) {
      room = { players: new Map() };
      rooms.set(roomId, room);
    }

    // Check if room is full (max 2 players)
    if (room.players.size >= 2 && !room.players.has(socket.id)) {
      socket.emit('error', 'Room is full');
      return;
    }

    // Join the socket room
    socket.join(roomId);
    
    // Assign color if not already in room
    if (!room.players.has(socket.id)) {
      let color;
      if (room.players.size === 0) {
        color = Math.random() < 0.5 ? 'w' : 'b';
      } else {
        const otherPlayer = Array.from(room.players.values())[0];
        color = otherPlayer.color === 'w' ? 'b' : 'w';
      }
      room.players.set(socket.id, { color, id: socket.id, name: playerName || 'Anonymous' });
      console.log(`User ${socket.id} (${playerName}) assigned ${color} in room ${roomId}`);
    }

    const currentPlayers = Array.from(room.players.values());
    
    // Notify the joining player of their assignment and room state
    socket.emit('roomJoined', {
      roomId,
      players: currentPlayers,
      yourColor: room.players.get(socket.id).color
    });

    // Notify others
    socket.to(roomId).emit('playerJoined', currentPlayers);
    emitGlobalStats();
  });

  socket.on('move', ({ roomId, move }) => {
    socket.to(roomId).emit('move', move);
  });

  socket.on('resetGame', (roomId) => {
    socket.to(roomId).emit('resetGame');
  });

  socket.on('chatMessage', ({ roomId, message, sender }) => {
    io.to(roomId).emit('chatMessage', { message, sender });
  });

  socket.on('disconnect', () => {
    globalOnlineCount--;
    console.log('User disconnected:', socket.id);

    // Clean up rooms
    rooms.forEach((room, roomId) => {
      if (room.players.has(socket.id)) {
        room.players.delete(socket.id);
        if (room.players.size === 0) {
          rooms.delete(roomId);
        } else {
          io.to(roomId).emit('playerLeft', Array.from(room.players.values()));
        }
      }
    });

    emitGlobalStats();
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Chess Server running on port ${PORT}`);
});

