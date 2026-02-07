import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import {
  getAllClosetItems,
  getClosetItemById,
  createClosetItem,
  updateClosetItem,
  deleteClosetItem,
  bulkCreateClosetItems,
  searchClosetItems,
} from '../utils/database-entities';
import { getClosetById } from '../utils/database-entities';
import { getRelationshipsByStylist } from '../utils/database-entities';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Helper to check if user can access closet
async function canAccessCloset(
  userId: string,
  userType: string,
  closetId: string
): Promise<boolean> {
  const closet = await getClosetById(closetId);
  if (!closet) return false;
  
  if (userType === 'client') {
    // Clients can only access their own closet (stylistId null)
    const { findUserById } = await import('../utils/database');
    const { getClientByEmail } = await import('../utils/database-entities');
    
    const user = await findUserById(userId);
    if (!user) return false;
    
    const client = await getClientByEmail(user.email);
    if (!client) return false;
    
    return client.id === closet.ownerId && (closet.stylistId == null || closet.stylistId === undefined);
  }
  
  // Stylist: check relationship and (stylist-owned closet or client's own closet for look editing)
  const relationships = await getRelationshipsByStylist(userId);
  const hasRelationship = relationships.some(r => r.clientId === closet.ownerId);
  const ownsCloset = closet.stylistId === userId || (closet.stylistId == null && closet.createdBy === userId);
  const isClientOwnCloset = closet.stylistId == null || closet.stylistId === undefined;
  return hasRelationship && (ownsCloset || isClientOwnCloset);
}

/**
 * GET /api/closet-items
 * Get closet items, optionally filtered by closetId, search query, and category
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { closetId, search, category } = req.query;
    
    if (closetId && typeof closetId === 'string') {
      // Check access
      const hasAccess = await canAccessCloset(userId, req.userType!, closetId);
      if (!hasAccess) {
        return res.status(403).json({ error: { message: 'Access denied' } });
      }
      
      // Search or get all
      if (search || category) {
        const items = await searchClosetItems(
          closetId,
          search as string | undefined,
          category as string | undefined
        );
        return res.json({ data: items });
      }
      
      const items = await getAllClosetItems(closetId);
      return res.json({ data: items });
    }
    
    // If no closetId, return empty or all accessible (for admins)
    res.json({ data: [] });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * GET /api/closet-items/:id
 * Get a specific closet item by ID
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    
    const item = await getClosetItemById(id);
    if (!item) {
      return res.status(404).json({ error: { message: 'Closet item not found' } });
    }
    
    // Check access to the closet
    const hasAccess = await canAccessCloset(userId, req.userType!, item.closetId);
    if (!hasAccess) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }
    
    res.json({ data: item });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * POST /api/closet-items
 * Create a new closet item (stylists and clients with closet access)
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    
    const itemData = req.body;
    
    if (!itemData.closetId) {
      return res.status(400).json({ error: { message: 'closetId is required' } });
    }
    
    // Check access
    const hasAccess = await canAccessCloset(userId, req.userType!, itemData.closetId);
    if (!hasAccess) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }
    
    // Validate required fields
    if (!itemData.name || !itemData.category || !itemData.photoUrl) {
      return res.status(400).json({ error: { message: 'Name, category, and photoUrl are required' } });
    }
    
    // Ensure colorTags is an array
    if (!Array.isArray(itemData.colorTags)) {
      itemData.colorTags = [];
    }
    
    const item = await createClosetItem(itemData, userId);
    res.status(201).json({ data: item });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * POST /api/closet-items/bulk
 * Bulk create closet items (stylists and clients with closet access)
 */
router.post('/bulk', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    
    const itemsData = req.body.items || req.body;
    
    if (!Array.isArray(itemsData) || itemsData.length === 0) {
      return res.status(400).json({ error: { message: 'Array of items is required' } });
    }
    
    // Check access for all closets
    const closetIds = [...new Set(itemsData.map((item: any) => item.closetId))];
    for (const closetId of closetIds) {
      const hasAccess = await canAccessCloset(userId, req.userType!, closetId);
      if (!hasAccess) {
        return res.status(403).json({ error: { message: `Access denied to closet ${closetId}` } });
      }
    }
    
    // Validate all items
    for (const itemData of itemsData) {
      if (!itemData.name || !itemData.category || !itemData.photoUrl || !itemData.closetId) {
        return res.status(400).json({ error: { message: 'All items must have name, category, photoUrl, and closetId' } });
      }
      if (!Array.isArray(itemData.colorTags)) {
        itemData.colorTags = [];
      }
    }
    
    const items = await bulkCreateClosetItems(itemsData, userId);
    res.status(201).json({ data: items });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * PUT /api/closet-items/:id
 * Update a closet item (stylists and clients with closet access)
 */
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    
    const item = await getClosetItemById(id);
    if (!item) {
      return res.status(404).json({ error: { message: 'Closet item not found' } });
    }
    
    // Check access
    const hasAccess = await canAccessCloset(userId, req.userType!, item.closetId);
    if (!hasAccess) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }
    
    const updated = await updateClosetItem(id, req.body, userId);
    res.json({ data: updated });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * DELETE /api/closet-items/:id
 * Delete a closet item (stylists and clients with closet access)
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    
    const item = await getClosetItemById(id);
    if (!item) {
      return res.status(404).json({ error: { message: 'Closet item not found' } });
    }
    
    // Check access
    const hasAccess = await canAccessCloset(userId, req.userType!, item.closetId);
    if (!hasAccess) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }
    
    const deleted = await deleteClosetItem(id);
    if (!deleted) {
      return res.status(404).json({ error: { message: 'Closet item not found' } });
    }
    
    res.json({ data: { success: true } });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

export default router;
