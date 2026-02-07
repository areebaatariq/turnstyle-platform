import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import {
  getChatRoomById,
  getChatRoomByLookId,
  getChatRoomsByUserId,
  getChatRoomsWithDetails,
  getChatRoomMessages,
  createMessage,
  markChatRoomMessagesAsRead,
  getLookById,
  getClientById,
  getClientByEmail,
} from '../utils/database-entities';
import { findUserById } from '../utils/database';
import { getIO } from '../socket/socket';
import { ChatRoom, Message } from '../types';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/messages/chat-rooms
 * Get all chat rooms (look-based conversations) for the authenticated user
 */
router.get('/chat-rooms', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const userType = req.userType;
    
    console.log(`📬 GET /chat-rooms - userId: ${userId}, userType: ${userType}`);
    
    let chatRooms: Array<ChatRoom & { lastMessage?: Message; unreadCount: number }>;
    try {
      chatRooms = await getChatRoomsWithDetails(userId);
      console.log(`   Initial chatRooms count: ${chatRooms.length}`);
    } catch (err: any) {
      console.error(`   ❌ Error getting chat rooms with details:`, err.message);
      chatRooms = [];
    }
    
    // For clients, we need to find chat rooms by client ID (not user ID)
    if (userType === 'client') {
      const user = await findUserById(userId);
      console.log(`   Client user found: ${user?.email}`);
      if (user) {
        const client = await getClientByEmail(user.email);
        console.log(`   Client record found: ${client?.id}`);
        if (client) {
          // Get chat rooms where this client is a participant
          chatRooms = await getChatRoomsWithDetails(client.id);
          console.log(`   Client chatRooms count: ${chatRooms.length}`);
        }
      }
    }
    
    // Enrich with look data and participant names
    const enrichedChatRooms = await Promise.all(
      chatRooms.map(async (chatRoom) => {
        const look = await getLookById(chatRoom.lookId);
        const client = await getClientById(chatRoom.clientId);
        const stylist = await findUserById(chatRoom.stylistId);
        
        return {
          ...chatRoom,
          look: look || undefined,
          clientName: client?.name || 'Unknown Client',
          clientPhoto: client?.profilePhotoUrl,
          stylistName: stylist?.name || 'Unknown Stylist',
          stylistPhoto: stylist?.profilePhotoUrl,
        };
      })
    );
    
    // Sort by last message date (most recent first)
    enrichedChatRooms.sort((a, b) => {
      if (!a.lastMessage && !b.lastMessage) return 0;
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime();
    });
    
    res.json({ data: enrichedChatRooms });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * GET /api/messages/chat-room/:chatRoomId
 * Get messages in a specific chat room
 */
router.get('/chat-room/:chatRoomId', async (req: AuthRequest, res: Response) => {
  try {
    const { chatRoomId } = req.params;
    const userId = req.userId!;
    const userType = req.userType;
    
    // Get chat room
    const chatRoom = await getChatRoomById(chatRoomId);
    if (!chatRoom) {
      return res.status(404).json({ error: { message: 'Chat room not found' } });
    }
    
    // Verify user has access to this chat room
    let hasAccess = chatRoom.stylistId === userId;
    
    if (!hasAccess && userType === 'client') {
      const user = await findUserById(userId);
      if (user) {
        const client = await getClientByEmail(user.email);
        hasAccess = client?.id === chatRoom.clientId;
      }
    }
    
    if (!hasAccess) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }
    
    const messages = await getChatRoomMessages(chatRoomId);
    res.json({ data: messages });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * GET /api/messages/look/:lookId
 * Get chat room and messages for a specific look
 */
router.get('/look/:lookId', async (req: AuthRequest, res: Response) => {
  try {
    const { lookId } = req.params;
    const userId = req.userId!;
    const userType = req.userType;
    
    // Get chat room by look ID
    const chatRoom = await getChatRoomByLookId(lookId);
    if (!chatRoom) {
      return res.status(404).json({ error: { message: 'No chat room found for this look. The look may not have been sent for approval yet.' } });
    }
    
    // Verify user has access to this chat room
    let hasAccess = chatRoom.stylistId === userId;
    
    if (!hasAccess && userType === 'client') {
      const user = await findUserById(userId);
      if (user) {
        const client = await getClientByEmail(user.email);
        hasAccess = client?.id === chatRoom.clientId;
      }
    }
    
    if (!hasAccess) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }
    
    // Get look info
    const look = await getLookById(lookId);
    const client = await getClientById(chatRoom.clientId);
    const stylist = await findUserById(chatRoom.stylistId);
    
    // Get messages
    const messages = await getChatRoomMessages(chatRoom.id);
    
    res.json({
      data: {
        chatRoom: {
          ...chatRoom,
          look: look || undefined,
          clientName: client?.name || 'Unknown Client',
          clientPhoto: client?.profilePhotoUrl,
          stylistName: stylist?.name || 'Unknown Stylist',
          stylistPhoto: stylist?.profilePhotoUrl,
        },
        messages,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * POST /api/messages
 * Send a message to a chat room
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const userType = req.userType;
    const { chatRoomId, messageText } = req.body;
    
    if (!chatRoomId || !messageText) {
      return res.status(400).json({ error: { message: 'chatRoomId and messageText are required' } });
    }
    
    // Get chat room
    const chatRoom = await getChatRoomById(chatRoomId);
    if (!chatRoom) {
      return res.status(404).json({ error: { message: 'Chat room not found' } });
    }
    
    // Verify user has access to this chat room
    let senderId = userId;
    let hasAccess = chatRoom.stylistId === userId;
    
    if (!hasAccess && userType === 'client') {
      const user = await findUserById(userId);
      if (user) {
        const client = await getClientByEmail(user.email);
        if (client?.id === chatRoom.clientId) {
          hasAccess = true;
          senderId = userId; // Keep the user ID as sender
        }
      }
    }
    
    if (!hasAccess) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }
    
    // Create message
    const message = await createMessage({ chatRoomId, messageText }, senderId);
    
    // Emit message via Socket.IO
    const io = getIO();
    const roomId = `chatroom:${chatRoomId}`;
    io.to(roomId).emit('new-message', message);
    
    // Also emit to participants' personal rooms
    io.to(`user:${chatRoom.stylistId}`).emit('message-received', { message, chatRoom });
    
    // For client, we need to find their user ID
    const client = await getClientById(chatRoom.clientId);
    if (client) {
      const { findUserByEmail } = await import('../utils/database');
      const clientUser = await findUserByEmail(client.email);
      if (clientUser) {
        io.to(`user:${clientUser.id}`).emit('message-received', { message, chatRoom });
      }
    }
    
    console.log(`📤 Socket.IO: Message ${message.id} emitted to room ${roomId}`);
    console.log(`   ChatRoom: ${chatRoomId}, Look: ${chatRoom.lookId}`);
    
    res.status(201).json({ data: message });
  } catch (error: any) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * POST /api/messages/chat-room/:chatRoomId/read
 * Mark messages in a chat room as read
 */
router.post('/chat-room/:chatRoomId/read', async (req: AuthRequest, res: Response) => {
  try {
    const { chatRoomId } = req.params;
    const userId = req.userId!;
    const userType = req.userType;
    
    // Get chat room
    const chatRoom = await getChatRoomById(chatRoomId);
    if (!chatRoom) {
      return res.status(404).json({ error: { message: 'Chat room not found' } });
    }
    
    // Verify user has access to this chat room
    let hasAccess = chatRoom.stylistId === userId;
    let readerUserId = userId;
    
    if (!hasAccess && userType === 'client') {
      const user = await findUserById(userId);
      if (user) {
        const client = await getClientByEmail(user.email);
        if (client?.id === chatRoom.clientId) {
          hasAccess = true;
          readerUserId = userId;
        }
      }
    }
    
    if (!hasAccess) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }
    
    await markChatRoomMessagesAsRead(chatRoomId, readerUserId);
    res.json({ data: { success: true } });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * GET /api/messages/unread-count
 * Get total unread message count for the authenticated user
 */
router.get('/unread-count', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const userType = req.userType;
    
    let chatRooms = await getChatRoomsWithDetails(userId);
    
    // For clients, we need to find chat rooms by client ID
    if (userType === 'client') {
      const user = await findUserById(userId);
      if (user) {
        const client = await getClientByEmail(user.email);
        if (client) {
          chatRooms = await getChatRoomsWithDetails(client.id);
        }
      }
    }
    
    const totalUnread = chatRooms.reduce((total, cr) => total + cr.unreadCount, 0);
    res.json({ data: { unreadCount: totalUnread } });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

// ==================== DEPRECATED ROUTES (for backwards compatibility) ====================

/**
 * @deprecated Use GET /api/messages/chat-rooms instead
 */
router.get('/conversations', async (req: AuthRequest, res: Response) => {
  console.warn('DEPRECATED: /api/messages/conversations - use /api/messages/chat-rooms');
  res.json({ data: [], warning: 'This endpoint is deprecated. Use /api/messages/chat-rooms instead.' });
});

/**
 * @deprecated Use GET /api/messages/chat-room/:chatRoomId instead
 */
router.get('/conversation/:userId', async (req: AuthRequest, res: Response) => {
  console.warn('DEPRECATED: /api/messages/conversation/:userId - use /api/messages/chat-room/:chatRoomId');
  res.json({ data: [], warning: 'This endpoint is deprecated. Use /api/messages/chat-room/:chatRoomId instead.' });
});

export default router;
