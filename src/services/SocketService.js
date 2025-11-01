import { io } from 'socket.io-client';

class SocketService {
  socket;

  connect() {
    if (this.socket) return; // 防止重複連線

    // 伺服器URL，請根據您的後端位址修改
    // 開發時指向本地的 3001 port，部署後可能需要指向您的 Render 服務位址
    const serverUrl = 'https://td-game-server.onrender.com';

    console.log(`[SocketService] Connecting to ${serverUrl}...`);
    this.socket = io(serverUrl);

    this.socket.on('connect', () => {
      console.log(`[SocketService] Connected to server with ID: ${this.socket.id}`);
    });

    this.socket.on('disconnect', () => {
      console.log('[SocketService] Disconnected from server.');
    });

    this.socket.on('connect_error', (err) => {
      console.error('[SocketService] Connection Error:', err.message);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // 發送事件到伺服器
  emit(eventName, data) {
    if (this.socket) {
      console.log(`[SocketService.emit] 發送事件: ${eventName}`, data);
      this.socket.emit(eventName, data);
    } else {
      console.error(`[SocketService.emit] 錯誤：socket 未連接，無法發送事件: ${eventName}`);
    }
  }

  // 監聽來自伺服器的事件
  on(eventName, callback) {
    if (this.socket) {
      this.socket.on(eventName, callback);
    }
  }

  off(eventName, callback) {
    if (!this.socket) return;
    if (callback) {
      this.socket.off(eventName, callback);
    } else {
      this.socket.off(eventName);
    }
  }

  get id() {
    return this.socket ? this.socket.id : null;
  }
}

// 導出一個單例，讓整個遊戲共享同一個連線
export default new SocketService();
