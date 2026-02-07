import { Message, ChatRoom } from '@/types';
import { apiRequest, ApiResponse } from './api';

// ==================== CHAT ROOM OPERATIONS (Look-Based) ====================

/**
 * Get all chat rooms for the current user
 * Each chat room is associated with a specific Look
 */
export const getChatRooms = async (): Promise<ChatRoom[]> => {
  try {
    const response = await apiRequest<ApiResponse<ChatRoom[]>>('/messages/chat-rooms');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching chat rooms:', error);
    return [];
  }
};

/**
 * Get messages for a specific chat room
 */
export const getChatRoomMessages = async (chatRoomId: string): Promise<Message[]> => {
  try {
    const response = await apiRequest<ApiResponse<Message[]>>(`/messages/chat-room/${chatRoomId}`);
    return response.data || [];
  } catch (error) {
    console.error('Error fetching chat room messages:', error);
    return [];
  }
};

/**
 * Get chat room and messages for a specific look
 * Returns the chat room with enriched data and all messages
 */
export const getChatRoomByLookId = async (lookId: string): Promise<{ chatRoom: ChatRoom; messages: Message[] } | null> => {
  try {
    const response = await apiRequest<ApiResponse<{ chatRoom: ChatRoom; messages: Message[] }>>(`/messages/look/${lookId}`);
    return response.data || null;
  } catch (error) {
    console.error('Error fetching chat room by look ID:', error);
    return null;
  }
};

/**
 * Send a message to a chat room
 */
export const sendMessage = async (chatRoomId: string, messageText: string): Promise<Message> => {
  try {
    const response = await apiRequest<ApiResponse<Message>>('/messages', {
      method: 'POST',
      body: JSON.stringify({
        chatRoomId,
        messageText,
      }),
    });
    if (!response.data) {
      throw new Error('Failed to send message');
    }
    return response.data;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

/**
 * Mark all messages in a chat room as read
 */
export const markChatRoomAsRead = async (chatRoomId: string): Promise<void> => {
  try {
    await apiRequest<ApiResponse<{ success: boolean }>>(`/messages/chat-room/${chatRoomId}/read`, {
      method: 'POST',
    });
  } catch (error) {
    console.error('Error marking chat room as read:', error);
  }
};

/**
 * Get total unread message count
 */
export const getTotalUnreadCount = async (): Promise<number> => {
  try {
    const response = await apiRequest<ApiResponse<{ unreadCount: number }>>('/messages/unread-count');
    return response.data?.unreadCount || 0;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};

// ==================== DEPRECATED (for backwards compatibility) ====================

/**
 * @deprecated Use getChatRooms instead
 */
export const getConversations = async (): Promise<any[]> => {
  console.warn('DEPRECATED: getConversations - use getChatRooms instead');
  return [];
};

/**
 * @deprecated Use getChatRoomMessages instead
 */
export const getConversationMessages = async (userId: string): Promise<Message[]> => {
  console.warn('DEPRECATED: getConversationMessages - use getChatRoomMessages instead');
  return [];
};

/**
 * @deprecated Use markChatRoomAsRead instead
 */
export const markConversationAsRead = async (userId: string): Promise<void> => {
  console.warn('DEPRECATED: markConversationAsRead - use markChatRoomAsRead instead');
};

/**
 * @deprecated Messages are now look-based
 */
export const getMessages = async (): Promise<Message[]> => {
  console.warn('DEPRECATED: getMessages - use getChatRooms and getChatRoomMessages instead');
  return [];
};

/**
 * @deprecated Not applicable in look-based messaging
 */
export const markMessageAsRead = async (messageId: string): Promise<boolean> => {
  console.warn('DEPRECATED: markMessageAsRead - use markChatRoomAsRead instead');
  return true;
};

/**
 * @deprecated Not implemented
 */
export const deleteMessage = async (messageId: string): Promise<boolean> => {
  console.warn('deleteMessage is not implemented');
  return false;
};
