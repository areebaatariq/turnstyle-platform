import { io, Socket } from 'socket.io-client';
import { getAuthToken } from './api';
import { Message, ChatRoom } from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface MessageReceivedData {
  message: Message;
  chatRoom: ChatRoom;
}

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  connect(): Socket | null {
    if (this.socket?.connected) {
      return this.socket;
    }

    const token = getAuthToken();
    if (!token) {
      console.error('Socket.IO: No auth token available');
      return null;
    }

    console.log('🔌 Socket.IO: Connecting...');

    this.socket = io(API_BASE_URL, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket.IO: Connected', this.socket?.id);
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 Socket.IO: Disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket.IO: Connection error', error.message);
    });

    // Listen for new messages in current chat room
    this.socket.on('new-message', (message: Message) => {
      console.log('📨 Socket.IO: New message received in chat room', message);
      this.emit('new-message', message);
    });

    // Listen for message received notification (for any chat room)
    this.socket.on('message-received', (data: MessageReceivedData) => {
      console.log('📥 Socket.IO: Message received notification', data);
      this.emit('message-received', data);
    });

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      console.log('🔌 Socket.IO: Disconnecting...');
      this.socket.disconnect();
      this.socket = null;
      this.listeners.clear();
    }
  }

  // Join a chat room (look-based)
  joinChatRoom(chatRoomId: string): void {
    if (this.socket?.connected) {
      console.log(`📥 Socket.IO: Joining chat room ${chatRoomId}`);
      this.socket.emit('join-chat-room', chatRoomId);
    }
  }

  // Leave a chat room
  leaveChatRoom(chatRoomId: string): void {
    if (this.socket?.connected) {
      console.log(`📤 Socket.IO: Leaving chat room ${chatRoomId}`);
      this.socket.emit('leave-chat-room', chatRoomId);
    }
  }

  // DEPRECATED: Old conversation methods
  joinConversation(otherUserId: string): void {
    console.warn('DEPRECATED: joinConversation - use joinChatRoom instead');
  }

  leaveConversation(otherUserId: string): void {
    console.warn('DEPRECATED: leaveConversation - use leaveChatRoom instead');
  }

  on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  }

  off(event: string, callback?: (data: any) => void): void {
    if (callback) {
      this.listeners.get(event)?.delete(callback);
    } else {
      this.listeners.delete(event);
    }
  }

  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in socket listener for ${event}:`, error);
        }
      });
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

// Export singleton instance
export const socketService = new SocketService();
