import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import {
  getRelationshipsByStylist,
  getRelationshipById,
  createRelationship,
  updateRelationshipStatus,
} from '../utils/database-entities';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/relationships
 * Get all relationships for the authenticated stylist
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const stylistId = req.userId!;
    const relationships = await getRelationshipsByStylist(stylistId);
    res.json({ data: relationships });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * GET /api/relationships/:id
 * Get a specific relationship by ID
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const stylistId = req.userId!;
    
    const relationship = await getRelationshipById(id);
    if (!relationship) {
      return res.status(404).json({ error: { message: 'Relationship not found' } });
    }
    
    // Check if stylist owns this relationship
    if (relationship.stylistId !== stylistId) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }
    
    res.json({ data: relationship });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * POST /api/relationships
 * Create a new relationship
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const stylistId = req.userId!;
    const { clientId, status } = req.body;
    
    if (!clientId) {
      return res.status(400).json({ error: { message: 'clientId is required' } });
    }
    
    const relationship = await createRelationship(
      stylistId,
      clientId,
      status || 'invited'
    );
    
    res.status(201).json({ data: relationship });
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      return res.status(409).json({ error: { message: error.message } });
    }
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * PATCH /api/relationships/:id/status
 * Update relationship status
 */
router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const stylistId = req.userId!;
    
    if (!status || !['invited', 'active', 'ended'].includes(status)) {
      return res.status(400).json({ error: { message: 'Valid status is required' } });
    }
    
    const relationship = await getRelationshipById(id);
    if (!relationship) {
      return res.status(404).json({ error: { message: 'Relationship not found' } });
    }
    
    // Check if stylist owns this relationship
    if (relationship.stylistId !== stylistId) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }
    
    const updated = await updateRelationshipStatus(id, status);
    res.json({ data: updated });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

export default router;
