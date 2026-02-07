import express, { Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireStylist } from '../middleware/roleGuard';
import {
  getAllLooks,
  getLookById,
  createLook,
  updateLook,
  deleteLook,
  deleteLookItemsByLookId,
  getOrCreateChatRoom,
  deleteChatRoomByLookId,
  deleteMessagesByChatRoomId,
  getChatRoomByLookId,
  getAllLookItems,
  getAllClosetItems,
  getAllClosets,
  getRelationshipsByStylist,
  getRelationshipByStylistAndClient,
  updateRelationshipStatus,
} from '../utils/database-entities';
import { findUserById } from '../utils/database';
import { getClientById, getAllClients } from '../utils/database-entities';
import { sendLookApprovalEmail } from '../services/emailService';

const router = express.Router();

/**
 * GET /api/looks/public/:id/check
 * Public endpoint to check look info and if client user exists
 * Used for first-time user flow when clicking email links
 */
router.get('/public/:id/check', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const look = await getLookById(id);
    
    if (!look) {
      return res.status(404).json({ error: { message: 'Look not found' } });
    }
    
    // Get client info
    const client = await getClientById(look.clientId);
    if (!client) {
      return res.status(404).json({ error: { message: 'Client not found' } });
    }
    
    // Check if user exists for this client email
    const { findUserByEmail } = await import('../utils/database');
    const user = await findUserByEmail(client.email);
    
    res.json({
      data: {
        lookId: look.id,
        lookName: look.name,
        clientEmail: client.email,
        clientName: client.name,
        userExists: !!user,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

// All other routes require authentication
router.use(authenticateToken);

/**
 * GET /api/looks
 * Get looks filtered by stylistId and/or clientId
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    
    // Get query params
    const { stylistId, clientId } = req.query;
    
    // Stylists can see their own looks or filter by client
    // Clients can see looks made for them (need to find client record by user email)
    if (req.userType === 'stylist') {
      const looks = await getAllLooks(userId, clientId as string | undefined);
      res.json({ data: looks });
    } else {
      // For clients: find their client record by user email, then get looks by clientId
      const { findUserById } = await import('../utils/database');
      const { getClientByEmail } = await import('../utils/database-entities');
      
      const user = await findUserById(userId);
      if (!user) {
        return res.status(404).json({ error: { message: 'User not found' } });
      }
      
      // Find client record by user email
      const client = await getClientByEmail(user.email);
      if (!client) {
        // Client user exists but no client record - return empty array
        return res.json({ data: [] });
      }
      
      // Get all looks for this client (exclude drafts - clients shouldn't see drafts)
      const allLooks = await getAllLooks(undefined, client.id);
      const looks = allLooks.filter(look => look.status !== 'draft');
      res.json({ data: looks });
    }
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * GET /api/looks/with-items
 * Get all looks with their associated items and closet items in a single request
 * This eliminates N+1 queries for look items and closet items
 * NOTE: This route MUST come before /:id to avoid being treated as an ID
 */
router.get('/with-items', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    
    // Get all data in parallel (all are cached)
    const [allLooks, allLookItems, allClosetItems, allClosets, allClients] = await Promise.all([
      getAllLooks(),
      getAllLookItems(),
      getAllClosetItems(),
      getAllClosets(),
      getAllClients(),
    ]);
    
    // Build lookup maps for efficiency
    const lookItemsByLookId = new Map<string, typeof allLookItems>();
    for (const item of allLookItems) {
      if (!lookItemsByLookId.has(item.lookId)) {
        lookItemsByLookId.set(item.lookId, []);
      }
      lookItemsByLookId.get(item.lookId)!.push(item);
    }
    
    const closetItemsById = new Map<string, typeof allClosetItems[0]>();
    for (const item of allClosetItems) {
      closetItemsById.set(item.id, item);
    }
    
    const clientsById = new Map<string, typeof allClients[0]>();
    for (const client of allClients) {
      clientsById.set(client.id, client);
    }
    
    // Filter looks based on user type
    let filteredLooks;
    if (req.userType === 'stylist') {
      filteredLooks = allLooks.filter(look => look.stylistId === userId);
    } else {
      // For clients: find their client record by user email
      const { findUserById } = await import('../utils/database');
      const { getClientByEmail } = await import('../utils/database-entities');
      
      const user = await findUserById(userId);
      if (!user) {
        return res.status(404).json({ error: { message: 'User not found' } });
      }
      
      const client = await getClientByEmail(user.email);
      if (!client) {
        return res.json({ data: [] });
      }
      
      filteredLooks = allLooks.filter(look => 
        look.clientId === client.id && look.status !== 'draft'
      );
    }
    
    // Build response with all related data
    const result = filteredLooks.map(look => {
      const lookItems = lookItemsByLookId.get(look.id) || [];
      const client = clientsById.get(look.clientId);
      
      // Get actual closet items for each look item
      const resolvedItems = lookItems.map(lookItem => {
        if (lookItem.itemType === 'new_purchase' && lookItem.newItemDetails) {
          return {
            ...lookItem,
            closetItem: null,
            newItemDetails: lookItem.newItemDetails,
          };
        }
        
        const closetItem = closetItemsById.get(lookItem.itemId);
        return {
          ...lookItem,
          closetItem: closetItem || null,
        };
      });
      
      return {
        ...look,
        client: client || null,
        items: resolvedItems,
      };
    });
    
    res.json({ data: result });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * GET /api/looks/all-closet-items
 * Get all closet items for all clients the stylist has access to
 * Used for look creation - loads all available items at once
 * NOTE: This route MUST come before /:id to avoid being treated as an ID
 */
router.get('/all-closet-items', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    
    if (req.userType !== 'stylist') {
      return res.status(403).json({ error: { message: 'Stylists only' } });
    }
    
    // Get stylist's clients
    const relationships = await getRelationshipsByStylist(userId);
    const clientIds = new Set(relationships.map(r => r.clientId));
    
    // Get all data in parallel (all are cached)
    const [allClosets, allClosetItems] = await Promise.all([
      getAllClosets(),
      getAllClosetItems(),
    ]);
    
    // Build closet to owner map
    const closetToOwner = new Map<string, string>();
    for (const closet of allClosets) {
      closetToOwner.set(closet.id, closet.ownerId);
    }
    
    // Filter items to only those belonging to stylist's clients
    const accessibleItems = allClosetItems.filter(item => {
      const ownerId = closetToOwner.get(item.closetId);
      return ownerId && clientIds.has(ownerId) && !item.archived;
    });
    
    // Group by client for easier frontend consumption
    const itemsByClient = new Map<string, typeof allClosetItems>();
    for (const item of accessibleItems) {
      const ownerId = closetToOwner.get(item.closetId)!;
      if (!itemsByClient.has(ownerId)) {
        itemsByClient.set(ownerId, []);
      }
      itemsByClient.get(ownerId)!.push(item);
    }
    
    res.json({ 
      data: {
        items: accessibleItems,
        itemsByClient: Object.fromEntries(itemsByClient),
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * GET /api/looks/:id/with-items
 * Get a single look with resolved items (closet items from correct closet for both stylist and client)
 */
router.get('/:id/with-items', async (req: AuthRequest, res: Response) => {
  try {
    const { id: lookId } = req.params;
    const userId = req.userId!;
    
    const look = await getLookById(lookId);
    if (!look) {
      return res.status(404).json({ error: { message: 'Look not found' } });
    }
    
    if (req.userType === 'stylist') {
      if (look.stylistId !== userId) {
        return res.status(403).json({ error: { message: 'Access denied' } });
      }
    } else {
      const { findUserById } = await import('../utils/database');
      const { getClientByEmail } = await import('../utils/database-entities');
      const user = await findUserById(userId);
      if (!user) {
        return res.status(404).json({ error: { message: 'User not found' } });
      }
      const client = await getClientByEmail(user.email);
      if (!client || look.clientId !== client.id) {
        return res.status(403).json({ error: { message: 'Access denied' } });
      }
    }
    
    const [allLookItems, allClosetItems] = await Promise.all([
      getAllLookItems(lookId),
      getAllClosetItems(),
    ]);
    const closetItemsById = new Map(allClosetItems.map((i) => [i.id, i]));
    const resolvedItems = allLookItems.map((lookItem) => {
      if (lookItem.itemType === 'new_purchase' && lookItem.newItemDetails) {
        return { ...lookItem, closetItem: null as any, newItemDetails: lookItem.newItemDetails };
      }
      const closetItem = closetItemsById.get(lookItem.itemId) || null;
      return { ...lookItem, closetItem };
    });
    
    const clientRecord = await getClientById(look.clientId);
    res.json({
      data: {
        look,
        client: clientRecord || null,
        items: resolvedItems,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * GET /api/looks/:id
 * Get a specific look by ID
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    
    const look = await getLookById(id);
    if (!look) {
      return res.status(404).json({ error: { message: 'Look not found' } });
    }
    
    // Check access: stylist created it or client it's for
    if (req.userType === 'stylist') {
      if (look.stylistId !== userId) {
        return res.status(403).json({ error: { message: 'Access denied' } });
      }
    } else {
      // For clients: find their client record by user email, then check if look belongs to that client
      const { findUserById } = await import('../utils/database');
      const { getClientByEmail } = await import('../utils/database-entities');
      
      const user = await findUserById(userId);
      if (!user) {
        return res.status(404).json({ error: { message: 'User not found' } });
      }
      
      // Find client record by user email
      const client = await getClientByEmail(user.email);
      if (!client || look.clientId !== client.id) {
        return res.status(403).json({ error: { message: 'Access denied' } });
      }
    }
    
    res.json({ data: look });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * POST /api/looks
 * Create a new look
 * SECURITY: Stylist-only endpoint (enforced by middleware)
 */
router.post('/', requireStylist, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    
    const lookData = req.body;
    
    if (!lookData.clientId || !lookData.name) {
      return res.status(400).json({ error: { message: 'clientId and name are required' } });
    }
    
    const look = await createLook(lookData, userId);
    res.status(201).json({ data: look });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * PUT /api/looks/:id
 * Update a look
 */
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    
    const look = await getLookById(id);
    if (!look) {
      return res.status(404).json({ error: { message: 'Look not found' } });
    }
    
    // Clients can only update status (approve/decline)
    if (req.userType === 'client') {
      // For clients: find their client record by user email, then check if look belongs to that client
      const { findUserById } = await import('../utils/database');
      const { getClientByEmail } = await import('../utils/database-entities');
      
      const user = await findUserById(userId);
      if (!user) {
        return res.status(404).json({ error: { message: 'User not found' } });
      }
      
      // Find client record by user email
      const client = await getClientByEmail(user.email);
      if (!client || look.clientId !== client.id) {
        return res.status(403).json({ error: { message: 'Access denied' } });
      }
      
      // Only allow status updates for clients
      if (req.body.status && ['approved', 'changes_requested'].includes(req.body.status)) {
        // Check if current status allows this change
        if (look.status !== 'pending') {
          return res.status(400).json({ error: { message: 'Can only approve or request changes for pending looks' } });
        }
        
        console.log(`🔄 Client updating look status: ${look.id} from "${look.status}" to "${req.body.status}"`);
        const updated = await updateLook(id, { status: req.body.status });

        // Mark client as Active when they approve or request changes on a look
        if (updated) {
          const rel = await getRelationshipByStylistAndClient(look.stylistId, look.clientId);
          if (rel && rel.status !== 'active') {
            await updateRelationshipStatus(rel.id, 'active');
            console.log(`✅ Relationship marked active (client responded to look)`);
          }
        }

        if (updated) {
          console.log(`✅ Look status updated successfully: ${updated.id} -> ${updated.status}`);
          console.log(`   Look name: ${updated.name}`);
          console.log(`   Stylist ID: ${updated.stylistId}`);
          console.log(`   Client ID: ${updated.clientId}`);
        } else {
          console.error(`❌ Failed to update look: ${id}`);
        }
        
        return res.json({ data: updated });
      } else {
        return res.status(403).json({ error: { message: 'Clients can only update look status' } });
      }
    }
    
    // Stylists can update all fields of looks they created
    if (look.stylistId !== userId) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }
    
    // Prevent editing looks with status 'pending' or 'approved'
    if (look.status === 'pending' || look.status === 'approved') {
      return res.status(400).json({ 
        error: { message: `Cannot edit looks with status "${look.status}". Only drafts and looks with changes requested can be edited.` } 
      });
    }
    
    // If editing a 'changes_requested' look, automatically reset status to 'draft'
    // (unless status is explicitly being set to something else)
    const updateData = { ...req.body };
    if (look.status === 'changes_requested' && !req.body.status) {
      updateData.status = 'draft';
      console.log(`🔄 Look "${look.name}" has changes requested - resetting status to "draft" for editing`);
    }
    
    // Check if status is being changed to 'pending' (send for approval)
    // At this point look.status can only be 'draft' or 'changes_requested' (others returned early)
    const isSendingForApproval = updateData.status === 'pending';
    
    console.log('🔍 Look update check:', {
      requestedStatus: updateData.status,
      currentStatus: look.status,
      isSendingForApproval,
      lookId: id,
    });
    
    const updated = await updateLook(id, updateData);
    
    // If sending for approval, create a chat room for this look (if not exists)
    if (isSendingForApproval && updated) {
      try {
        const chatRoom = await getOrCreateChatRoom(updated.id, updated.stylistId, updated.clientId);
        console.log(`💬 Chat room created/retrieved for look "${updated.name}":`, chatRoom.id);
      } catch (chatRoomError: any) {
        console.error('❌ Failed to create chat room:', chatRoomError.message);
        // Don't fail the request if chat room creation fails
      }
    }
    
    // If sending for approval, send email notification to client
    if (isSendingForApproval && updated) {
      console.log('📧 Attempting to send look approval email...');
      try {
        // Get client and stylist info
        const client = await getClientById(updated.clientId);
        const stylist = await findUserById(updated.stylistId);
        
        console.log('🔍 Email send check:', {
          clientId: updated.clientId,
          clientEmail: client?.email,
          clientName: client?.name,
          stylistId: updated.stylistId,
          stylistName: stylist?.name,
          hasClient: !!client,
          hasClientEmail: !!client?.email,
          hasStylist: !!stylist,
        });
        
        if (client && client.email && stylist) {
          const frontendUrl = (process.env.FRONTEND_URL?.trim() || req.headers.origin || 'http://localhost:5137').replace(/\/$/, '');
          // Include lookId in the link so users can go directly to the specific look
          const lookLink = `${frontendUrl}/looks?lookId=${updated.id}`;
          
          console.log('📨 Sending look approval notification email to:', client.email);
          console.log('   Look:', updated.name);
          console.log('   Client:', client.name);
          console.log('   Stylist:', stylist.name);
          console.log('   Link:', lookLink);
          
          await sendLookApprovalEmail({
            to: client.email,
            clientName: client.name,
            stylistName: stylist.name,
            lookName: updated.name,
            lookLink,
            customMessage: updated.stylingNotes ? `Styling Notes: ${updated.stylingNotes}` : undefined,
          });
          
          console.log('✅ Look approval email sent successfully to:', client.email);
        } else {
          const missing = [];
          if (!client) missing.push('client');
          if (!client?.email) missing.push('client email');
          if (!stylist) missing.push('stylist');
          console.warn('⚠️ Could not send look approval email: missing', missing.join(', '));
        }
      } catch (emailError: any) {
        // Don't fail the request if email fails, just log it
        console.error('❌ Failed to send look approval email:', emailError.message);
        console.error('   Error stack:', emailError.stack);
        if (emailError.response) {
          console.error('   SendGrid error:', JSON.stringify(emailError.response.body, null, 2));
        }
      }
    } else {
      console.log('ℹ️ Not sending email - isSendingForApproval:', isSendingForApproval, 'hasUpdated:', !!updated);
    }
    
    res.json({ data: updated });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * DELETE /api/looks/:id
 * Delete a look
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    
    const look = await getLookById(id);
    if (!look) {
      return res.status(404).json({ error: { message: 'Look not found' } });
    }
    
    // Check access: only stylist who created it can delete
    if (look.stylistId !== userId) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }
    
    // Delete associated look items first
    await deleteLookItemsByLookId(id);
    
    // Delete associated chat room and messages
    const chatRoom = await getChatRoomByLookId(id);
    if (chatRoom) {
      await deleteMessagesByChatRoomId(chatRoom.id);
      await deleteChatRoomByLookId(id);
      console.log(`💬 Deleted chat room and messages for look: ${id}`);
    }
    
    const deleted = await deleteLook(id);
    if (!deleted) {
      return res.status(404).json({ error: { message: 'Look not found' } });
    }
    
    res.json({ data: { success: true } });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

export default router;
