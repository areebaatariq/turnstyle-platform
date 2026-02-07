import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import {
  getAllLookItems,
  getLookItemById,
  createLookItem,
  updateLookItem,
  deleteLookItem,
  deleteLookItemsByLookId,
  bulkCreateLookItems,
  getLookById,
} from '../utils/database-entities';
import { getAllLooks } from '../utils/database-entities';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/look-items
 * Get look items, optionally filtered by lookId
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { lookId } = req.query;
    const userId = req.userId!;
    
    let items = await getAllLookItems(lookId as string | undefined);
    
    // If lookId is provided, verify user has access to the look
    if (lookId) {
      const look = await getLookById(lookId as string);
      if (!look) {
        return res.status(404).json({ error: { message: 'Look not found' } });
      }
      
      if (req.userType === 'stylist') {
        // Stylists can only see items from their own looks
        if (look.stylistId !== userId) {
          return res.status(403).json({ error: { message: 'Access denied' } });
        }
      } else {
        // Clients: check if look belongs to their client record
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
    } else {
      // If no lookId, filter items by looks the user has access to
      if (req.userType === 'stylist') {
        // Stylists can see items from all their looks
        const { getAllLooks } = await import('../utils/database-entities');
        const looks = await getAllLooks(userId);
        const lookIds = new Set(looks.map(l => l.id));
        items = items.filter(item => lookIds.has(item.lookId));
      } else {
        // Clients: filter by looks that belong to their client record
        const { findUserById } = await import('../utils/database');
        const { getClientByEmail, getAllLooks } = await import('../utils/database-entities');
        
        const user = await findUserById(userId);
        if (!user) {
          return res.status(404).json({ error: { message: 'User not found' } });
        }
        
        const client = await getClientByEmail(user.email);
        if (!client) {
          return res.json({ data: [] }); // No client record, no looks
        }
        
        const looks = await getAllLooks(undefined, client.id);
        const lookIds = new Set(looks.map(l => l.id));
        items = items.filter(item => lookIds.has(item.lookId));
      }
    }
    
    res.json({ data: items });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * GET /api/look-items/:id
 * Get a specific look item by ID
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    
    const item = await getLookItemById(id);
    if (!item) {
      return res.status(404).json({ error: { message: 'Look item not found' } });
    }
    
    // Check access: verify user has access to the look
    const look = await getLookById(item.lookId);
    if (!look) {
      return res.status(404).json({ error: { message: 'Look not found' } });
    }
    
    if (req.userType === 'stylist') {
      if (look.stylistId !== userId) {
        return res.status(403).json({ error: { message: 'Access denied' } });
      }
    } else {
      // Client: check if look belongs to their client record
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
    
    res.json({ data: item });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * POST /api/look-items
 * Create a new look item
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const lookItemData = req.body;
    
    if (!lookItemData.lookId || !lookItemData.itemId) {
      return res.status(400).json({ error: { message: 'lookId and itemId are required' } });
    }
    
    // Check access: verify user has access to the look
    const look = await getLookById(lookItemData.lookId);
    if (!look) {
      return res.status(404).json({ error: { message: 'Look not found' } });
    }
    
    // Only stylists can add items to looks
    if (req.userType !== 'stylist') {
      return res.status(403).json({ error: { message: 'Only stylists can add items to looks' } });
    }
    
    if (look.stylistId !== userId) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }
    
    const item = await createLookItem(lookItemData);
    res.status(201).json({ data: item });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * POST /api/look-items/bulk
 * Bulk create look items
 */
router.post('/bulk', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const itemsData = req.body.items || req.body;
    
    if (!Array.isArray(itemsData) || itemsData.length === 0) {
      return res.status(400).json({ error: { message: 'Array of look items is required' } });
    }
    
    // Validate all items belong to same look and user has access
    const lookId = itemsData[0]?.lookId;
    if (!lookId) {
      return res.status(400).json({ error: { message: 'lookId is required for all items' } });
    }
    
    // Check if all items have same lookId
    if (!itemsData.every(item => item.lookId === lookId)) {
      return res.status(400).json({ error: { message: 'All items must belong to the same look' } });
    }
    
    // Check access
    const look = await getLookById(lookId);
    if (!look) {
      return res.status(404).json({ error: { message: 'Look not found' } });
    }
    
    if (req.userType !== 'stylist' || look.stylistId !== userId) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }
    
    // Validate required fields
    for (const itemData of itemsData) {
      if (!itemData.itemId) {
        return res.status(400).json({ error: { message: 'All items must have itemId' } });
      }
    }
    
    const items = await bulkCreateLookItems(itemsData);
    res.status(201).json({ data: items });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * PUT /api/look-items/:id
 * Update a look item
 */
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    
    const item = await getLookItemById(id);
    if (!item) {
      return res.status(404).json({ error: { message: 'Look item not found' } });
    }
    
    // Check access
    const look = await getLookById(item.lookId);
    if (!look) {
      return res.status(404).json({ error: { message: 'Look not found' } });
    }
    
    if (req.userType === 'stylist') {
      if (look.stylistId !== userId) {
        return res.status(403).json({ error: { message: 'Access denied' } });
      }
    } else {
      return res.status(403).json({ error: { message: 'Clients cannot modify look items' } });
    }
    
    const updated = await updateLookItem(id, req.body);
    res.json({ data: updated });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * DELETE /api/look-items/:id
 * Delete a look item
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    
    const item = await getLookItemById(id);
    if (!item) {
      return res.status(404).json({ error: { message: 'Look item not found' } });
    }
    
    // Check access
    const look = await getLookById(item.lookId);
    if (!look) {
      return res.status(404).json({ error: { message: 'Look not found' } });
    }
    
    if (req.userType === 'stylist') {
      if (look.stylistId !== userId) {
        return res.status(403).json({ error: { message: 'Access denied' } });
      }
    } else {
      return res.status(403).json({ error: { message: 'Clients cannot delete look items' } });
    }
    
    const deleted = await deleteLookItem(id);
    if (!deleted) {
      return res.status(404).json({ error: { message: 'Look item not found' } });
    }
    
    res.json({ data: { success: true } });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * DELETE /api/look-items/look/:lookId
 * Delete all items for a look (used when deleting a look)
 */
router.delete('/look/:lookId', async (req: AuthRequest, res: Response) => {
  try {
    const { lookId } = req.params;
    const userId = req.userId!;
    
    // Check access
    const look = await getLookById(lookId);
    if (!look) {
      return res.status(404).json({ error: { message: 'Look not found' } });
    }
    
    if (req.userType === 'stylist') {
      if (look.stylistId !== userId) {
        return res.status(403).json({ error: { message: 'Access denied' } });
      }
    } else {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }
    
    const deletedCount = await deleteLookItemsByLookId(lookId);
    res.json({ data: { success: true, deletedCount } });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

export default router;
