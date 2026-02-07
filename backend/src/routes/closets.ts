import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import {
  getClosetById,
  getClosetByOwnerId,
  getClosetsByOwnerId,
  getOrCreateCloset,
  createCloset,
  getAllClosets,
  getAllClosetItems,
} from '../utils/database-entities';
import { getRelationshipsByStylist } from '../utils/database-entities';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/closets
 * Get all closets accessible to the authenticated user
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    
    // If user is a stylist, get closets for their clients (scoped per stylist)
    if (req.userType === 'stylist') {
      const relationships = await getRelationshipsByStylist(userId);
      const clientIds = relationships.map(r => r.clientId);
      
      const allClosets = await getAllClosets();
      const closets = allClosets.filter(
        c => clientIds.includes(c.ownerId) && (c.stylistId === userId || (c.stylistId == null && c.createdBy === userId))
      );
      
      return res.json({ data: closets });
    }
    
    // If user is a client, get their own closet (ownerId = client record ID)
    const { findUserById } = await import('../utils/database');
    const { getClientByEmail } = await import('../utils/database-entities');
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ error: { message: 'User not found' } });
    const client = await getClientByEmail(user.email);
    if (!client) return res.json({ data: [] });
    const closet = await getClosetByOwnerId(client.id);
    res.json({ data: closet ? [closet] : [] });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * GET /api/closets/owner/:ownerId
 * Get or create a closet for a specific owner (stylist accessing client closet)
 */
router.get('/owner/:ownerId', async (req: AuthRequest, res: Response) => {
  try {
    const { ownerId } = req.params;
    const userId = req.userId!;
    
    // If stylist, check if they have relationship with this client
    if (req.userType === 'stylist') {
      const relationships = await getRelationshipsByStylist(userId);
      const hasRelationship = relationships.some(r => r.clientId === ownerId);
      
      if (!hasRelationship) {
        return res.status(403).json({ error: { message: 'Access denied' } });
      }
    } else {
      // Clients can access their own closet by client ID (not user ID)
      // Need to check if the ownerId (client ID) belongs to this client user
      const { findUserById } = await import('../utils/database');
      const { getClientByEmail } = await import('../utils/database-entities');
      
      const user = await findUserById(userId);
      if (!user) {
        return res.status(404).json({ error: { message: 'User not found' } });
      }
      
      const client = await getClientByEmail(user.email);
      if (!client || client.id !== ownerId) {
        return res.status(403).json({ error: { message: 'Access denied' } });
      }
    }
    
    const closet = await getOrCreateCloset(req.userType === 'stylist' ? userId : null, ownerId, userId);
    res.json({ data: closet });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * GET /api/closets/by-owner/:ownerId
 * Get all closets for a client (owner) with item counts. Stylist sees closets they own + client's own; client sees their own.
 */
router.get('/by-owner/:ownerId', async (req: AuthRequest, res: Response) => {
  try {
    const { ownerId } = req.params;
    const userId = req.userId!;
    let closets: Awaited<ReturnType<typeof getClosetsByOwnerId>>;

    if (req.userType === 'stylist') {
      const relationships = await getRelationshipsByStylist(userId);
      const hasRelationship = relationships.some(r => r.clientId === ownerId);
      if (!hasRelationship) {
        return res.status(403).json({ error: { message: 'Access denied' } });
      }
      const all = await getClosetsByOwnerId(ownerId);
      closets = all.filter(
        c => c.stylistId === userId || (c.stylistId == null && c.createdBy === userId)
      );
    } else {
      const { findUserById } = await import('../utils/database');
      const { getClientByEmail } = await import('../utils/database-entities');
      const user = await findUserById(userId);
      if (!user) return res.status(404).json({ error: { message: 'User not found' } });
      const client = await getClientByEmail(user.email);
      if (!client || client.id !== ownerId) {
        return res.status(403).json({ error: { message: 'Access denied' } });
      }
      const all = await getClosetsByOwnerId(ownerId);
      closets = all.filter(c => c.stylistId == null || c.stylistId === undefined);
    }

    const allItems = await getAllClosetItems();
    const countByClosetId = new Map<string, number>();
    for (const item of allItems) {
      if (!item.archived) countByClosetId.set(item.closetId, (countByClosetId.get(item.closetId) ?? 0) + 1);
    }
    const withCounts = closets.map(c => ({ ...c, itemCount: countByClosetId.get(c.id) ?? 0 }));
    return res.json({ data: withCounts });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * GET /api/closets/client/:clientId
 * Get the client's own closet (ownerId = clientId, stylistId = null).
 * Stylists only; used when editing a look so itemIds from look_items resolve to the correct closet.
 */
router.get('/client/:clientId', async (req: AuthRequest, res: Response) => {
  try {
    const { clientId } = req.params;
    const userId = req.userId!;

    if (req.userType !== 'stylist') {
      return res.status(403).json({ error: { message: 'Only stylists can access client closet by client id' } });
    }

    const relationships = await getRelationshipsByStylist(userId);
    const hasRelationship = relationships.some(r => r.clientId === clientId);
    if (!hasRelationship) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }

    const closet = await getClosetByOwnerId(clientId);
    if (!closet) {
      return res.status(404).json({ error: { message: 'Client closet not found' } });
    }

    res.json({ data: closet });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * POST /api/closets
 * Create a new closet for a client. Body: { ownerId: string, name: string }
 * Name is required and must be unique per client.
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { ownerId, name } = req.body;
    if (!ownerId || typeof ownerId !== 'string') {
      return res.status(400).json({ error: { message: 'ownerId is required' } });
    }
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (!trimmedName) {
      return res.status(400).json({ error: { message: 'Closet name is required' } });
    }

    if (req.userType === 'stylist') {
      const relationships = await getRelationshipsByStylist(userId);
      const hasRelationship = relationships.some(r => r.clientId === ownerId);
      if (!hasRelationship) {
        return res.status(403).json({ error: { message: 'Access denied' } });
      }
      try {
        const closet = await createCloset(ownerId, userId, { stylistId: userId, name: trimmedName });
        return res.status(201).json({ data: closet });
      } catch (err: any) {
        if (err?.code === 'DUPLICATE_CLOSET_NAME') {
          return res.status(400).json({ error: { message: 'A closet with this name already exists for this client' } });
        }
        throw err;
      }
    }

    const { findUserById } = await import('../utils/database');
    const { getClientByEmail } = await import('../utils/database-entities');
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ error: { message: 'User not found' } });
    const client = await getClientByEmail(user.email);
    if (!client || client.id !== ownerId) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }
    try {
      const closet = await createCloset(ownerId, userId, { stylistId: null, name: trimmedName });
      return res.status(201).json({ data: closet });
    } catch (err: any) {
      if (err?.code === 'DUPLICATE_CLOSET_NAME') {
        return res.status(400).json({ error: { message: 'A closet with this name already exists' } });
      }
      throw err;
    }
  } catch (error: any) {
    if (error?.code === 'CLOSET_NAME_REQUIRED' || error?.code === 'DUPLICATE_CLOSET_NAME') {
      return res.status(400).json({ error: { message: error.message } });
    }
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * GET /api/closets/:id
 * Get a specific closet by ID
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    
    const closet = await getClosetById(id);
    if (!closet) {
      return res.status(404).json({ error: { message: 'Closet not found' } });
    }
    
    // If stylist, check relationship and closet belongs to this stylist
    if (req.userType === 'stylist') {
      const relationships = await getRelationshipsByStylist(userId);
      const hasRelationship = relationships.some(r => r.clientId === closet.ownerId);
      const ownsCloset = closet.stylistId === userId || (closet.stylistId == null && closet.createdBy === userId);
      if (!hasRelationship || !ownsCloset) {
        return res.status(403).json({ error: { message: 'Access denied' } });
      }
    } else if (closet.ownerId !== userId) {
      // Clients can only access their own closet
      return res.status(403).json({ error: { message: 'Access denied' } });
    }
    
    res.json({ data: closet });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * POST /api/closets/batch
 * Get multiple clients' closets with item counts. Returns all closets per client and totalItemCount.
 * Body: { clientIds: string[] }
 */
router.post('/batch', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { clientIds } = req.body;
    
    if (!Array.isArray(clientIds)) {
      return res.status(400).json({ error: { message: 'clientIds must be an array' } });
    }
    
    // Verify access for stylists
    if (req.userType === 'stylist') {
      const relationships = await getRelationshipsByStylist(userId);
      const authorizedClientIds = new Set(relationships.map(r => r.clientId));
      
      const unauthorized = clientIds.filter(id => !authorizedClientIds.has(id));
      if (unauthorized.length > 0) {
        return res.status(403).json({ error: { message: 'Access denied to some clients' } });
      }
    }
    
    const allClosets = await getAllClosets();
    const allItems = await getAllClosetItems();
    const itemsByCloset = new Map<string, typeof allItems>();
    for (const item of allItems) {
      if (!item.archived) {
        if (!itemsByCloset.has(item.closetId)) itemsByCloset.set(item.closetId, []);
        itemsByCloset.get(item.closetId)!.push(item);
      }
    }
    
    const result = clientIds.map(clientId => {
      const closets = allClosets.filter(
        c =>
          c.ownerId === clientId &&
          (req.userType !== 'stylist' || c.stylistId === userId || (c.stylistId == null && c.createdBy === userId))
      );
      const closetsWithCount = closets.map(c => ({
        id: c.id,
        name: c.name,
        itemCount: (itemsByCloset.get(c.id) || []).length,
      }));
      const totalItemCount = closetsWithCount.reduce((sum, c) => sum + c.itemCount, 0);
      return {
        clientId,
        closets: closetsWithCount,
        totalItemCount,
        // First closet for backward compatibility when only one is used
        closet: closets[0] || null,
        itemCount: totalItemCount,
      };
    });
    
    res.json({ data: result });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * POST /api/closets/batch-with-items
 * Get multiple clients' closets with full items. Returns all closets per client.
 * Body: { clientIds: string[] }
 */
router.post('/batch-with-items', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { clientIds } = req.body;
    
    if (!Array.isArray(clientIds)) {
      return res.status(400).json({ error: { message: 'clientIds must be an array' } });
    }
    
    if (req.userType === 'stylist') {
      const relationships = await getRelationshipsByStylist(userId);
      const authorizedClientIds = new Set(relationships.map(r => r.clientId));
      const unauthorized = clientIds.filter(id => !authorizedClientIds.has(id));
      if (unauthorized.length > 0) {
        return res.status(403).json({ error: { message: 'Access denied to some clients' } });
      }
    }
    
    const allClosets = await getAllClosets();
    const allItems = await getAllClosetItems();
    const closetIdToItems = new Map<string, typeof allItems>();
    for (const item of allItems) {
      if (!item.archived) {
        if (!closetIdToItems.has(item.closetId)) closetIdToItems.set(item.closetId, []);
        closetIdToItems.get(item.closetId)!.push(item);
      }
    }
    
    const result = clientIds.map(clientId => {
      const closets = allClosets.filter(
        c =>
          c.ownerId === clientId &&
          (req.userType !== 'stylist' || c.stylistId === userId || (c.stylistId == null && c.createdBy === userId))
      );
      const closetsWithItems = closets.map(c => ({
        ...c,
        items: closetIdToItems.get(c.id) || [],
      }));
      const firstCloset = closetsWithItems[0] || null;
      return {
        clientId,
        closets: closetsWithItems,
        closet: firstCloset,
        items: firstCloset?.items ?? [],
      };
    });
    
    res.json({ data: result });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

export default router;
