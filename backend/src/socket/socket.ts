import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { verifyToken } from '../utils/jwt';

let ioInstance: SocketIOServer | null = null;

// Helper function to generate chat room socket room ID
export function getChatRoomSocketId(chatRoomId: string): string {
  return `chatroom:${chatRoomId}`;
}

// DEPRECATED: Old conversation room ID helper
export function getConversationRoomId(userId1: string, userId2: string): string {
  console.warn('DEPRECATED: getConversationRoomId - use getChatRoomSocketId instead');
  const sorted = [userId1, userId2].sort();
  return `conversation:${sorted[0]}:${sorted[1]}`;
}

export function initializeSocketIO(httpServer: HTTPServer): SocketIOServer {
  const frontendOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:5137',
    'https://turnstyle-wardrobe.onrender.com',
  ].filter((origin): origin is string => Boolean(origin));

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: frontendOrigins,
      credentials: true,
    },
  });

  // Socket.IO authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = verifyToken(token);
      socket.data.userId = decoded.userId;
      socket.data.userType = decoded.userType;
      socket.data.email = decoded.email;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Socket.IO connection handling
  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    const userType = socket.data.userType;
    
    console.log(`🔌 Socket.IO: User connected - ${userId} (${userType})`);
    
    // Join user's personal room (for receiving notifications)
    socket.join(`user:${userId}`);
    
    // Join a chat room (look-based)
    socket.on('join-chat-room', (chatRoomId: string) => {
      const roomId = getChatRoomSocketId(chatRoomId);
      socket.join(roomId);
      console.log(`📥 Socket.IO: User ${userId} joined chat room ${roomId}`);
    });

    // Leave a chat room
    socket.on('leave-chat-room', (chatRoomId: string) => {
      const roomId = getChatRoomSocketId(chatRoomId);
      socket.leave(roomId);
      console.log(`📤 Socket.IO: User ${userId} left chat room ${roomId}`);
    });

    // DEPRECATED: Old conversation events (for backwards compatibility)
    socket.on('join-conversation', (otherUserId: string) => {
      console.warn('DEPRECATED: join-conversation - use join-chat-room instead');
    });

    socket.on('leave-conversation', (otherUserId: string) => {
      console.warn('DEPRECATED: leave-conversation - use leave-chat-room instead');
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket.IO: User disconnected - ${userId}`);
    });
  });

  ioInstance = io;
  return io;
}

export function getIO(): SocketIOServer {
  if (!ioInstance) {
    throw new Error('Socket.IO not initialized. Call initializeSocketIO first.');
  }
  return ioInstance;
}
