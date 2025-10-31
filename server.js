const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // 允許所有來源的連線，方便開發
  }
});

const PORT = process.env.PORT || 3001;

// --- 遊戲邏輯變數 ---
let waitingPlayer = null;
const gameRooms = {};

const enqueuePlayer = (socket) => {
  if (socket.data?.roomId) return; // 已在遊戲中
  if (waitingPlayer && waitingPlayer.id !== socket.id) {
    const player1 = waitingPlayer;
    const player2 = socket;
    waitingPlayer = null;

    const roomId = `${player1.id}-${player2.id}`;
    gameRooms[roomId] = { players: [player1, player2] };

    player1.join(roomId);
    player2.join(roomId);
    player1.data.roomId = roomId;
    player2.data.roomId = roomId;
    player1.data.playerNumber = 1;
    player2.data.playerNumber = 2;

    player1.emit('game-start', { playerNumber: 1, opponentId: player2.id, roomId });
    player2.emit('game-start', { playerNumber: 2, opponentId: player1.id, roomId });

    console.log(`[Game] Game started in room ${roomId} between ${player1.id} and ${player2.id}`);
  } else {
    waitingPlayer = socket;
    waitingPlayer.emit('waiting-for-opponent');
    console.log(`[Game] User ${socket.id} is waiting for an opponent.`);
  }
};

// 如果是在生產環境 (例如 Render)，就提供打包好的前端靜態檔案
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

io.on('connection', (socket) => {
  console.log(`[Socket.IO] A user connected: ${socket.id}`);

  enqueuePlayer(socket);

  socket.on('queue-player', () => {
    enqueuePlayer(socket);
  });

  // 監聽斷線事件
  socket.on('disconnect', () => {
    console.log(`[Socket.IO] User disconnected: ${socket.id}`);
    if (socket === waitingPlayer) {
      waitingPlayer = null;
      console.log('[Game] The waiting player has disconnected.');
    }
    const roomId = socket.data?.roomId;
    if (roomId) {
      socket.to(roomId).emit('opponent-disconnected');
      const room = gameRooms[roomId];
      if (room) {
        room.players = room.players.filter(playerSocket => playerSocket.id !== socket.id);
        room.players.forEach(playerSocket => {
          playerSocket.data.roomId = null;
          playerSocket.leave(roomId);
        });
        delete gameRooms[roomId];
      }
    }
    // @TODO: 之後需要處理遊戲中斷線的狀況
  });

  // 監聽玩家建造塔的事件
  socket.on('build-tower', (data) => {
    // console.log(`[Game] Player ${socket.id} in room ${data.roomId} built a tower:`, data);
    // 使用 socket.to(roomId) 將事件轉發給房間內除了自己以外的所有人
    const roomId = data.roomId || socket.data?.roomId;
    if (roomId) {
      socket.to(roomId).emit('opponent-built-tower', data);
    }
  });

  socket.on('upgrade-tower', (data) => {
    const roomId = data.roomId || socket.data?.roomId;
    if (roomId) {
      socket.to(roomId).emit('opponent-upgraded-tower', data);
    }
  });

  socket.on('life-update', (data) => {
    const roomId = data.roomId || socket.data?.roomId;
    if (roomId) {
      socket.to(roomId).emit('opponent-life-update', data);
    }
  });

  socket.on('player-defeated', (data) => {
    const roomId = data.roomId || socket.data?.roomId;
    if (!roomId) return;
    socket.to(roomId).emit('opponent-defeated');
    const room = gameRooms[roomId];
    if (room) {
      room.players.forEach(playerSocket => {
        playerSocket.data.roomId = null;
        playerSocket.leave(roomId);
      });
      delete gameRooms[roomId];
    }
  });

  socket.on('wave-start', (data = {}) => {
    const roomId = data.roomId || socket.data?.roomId;
    if (!roomId) return;
    const payload = { wave: data.wave };
    socket.to(roomId).emit('wave-start', payload);
  });

  // 敵人生成/移除同步
  socket.on('enemy-spawn', (data = {}) => {
    const roomId = data.roomId || socket.data?.roomId;
    if (!roomId) return;
    const payload = {
      ...data,
      ownerId: socket.id
    };
    socket.to(roomId).emit('enemy-spawn', payload);
  });

  socket.on('enemy-died', (data = {}) => {
    const roomId = data.roomId || socket.data?.roomId;
    if (!roomId || !data.enemyId) return;
    socket.to(roomId).emit('enemy-died', {
      enemyId: data.enemyId
    });
  });

  socket.on('enemy-escaped', (data = {}) => {
    const roomId = data.roomId || socket.data?.roomId;
    if (!roomId || !data.enemyId) return;
    socket.to(roomId).emit('enemy-escaped', {
      enemyId: data.enemyId
    });
  });

  // 接收並轉發完整的遊戲狀態（任一玩家 -> 其他玩家）
  socket.on('game-state-sync', (data = {}) => {
    const roomId = data.roomId || socket.data?.roomId;
    if (!roomId) return;
    socket.to(roomId).emit('game-state-update', {
      ownerId: socket.id,
      enemies: data.enemies,
      timestamp: data.timestamp || Date.now()
    });
  });
});

server.listen(PORT, () => {
  console.log(`[Server] Express server with Socket.IO is listening on port ${PORT}`);
});
