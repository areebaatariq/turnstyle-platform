import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { findUserById, updateUser } from '../utils/database';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/users/me
 * Get current user profile
 */
router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const user = await findUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: { message: 'User not found' } });
    }
    
    // Don't send password hash
    const { password, ...userWithoutPassword } = user;
    
    res.json({ data: userWithoutPassword });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * GET /api/users/:id
 * Get a user by ID (for getting stylist/client info for messaging)
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    
    // Security: Only allow getting user info if:
    // 1. Getting own info
    // 2. Stylist getting client user info (for messaging)
    // 3. Client getting their stylist's info (for messaging)
    
    if (id === userId) {
      // Getting own info
      const user = await findUserById(id);
      if (!user) {
        return res.status(404).json({ error: { message: 'User not found' } });
      }
      const { password, ...userWithoutPassword } = user;
      return res.json({ data: userWithoutPassword });
    }
    
    // Check if there's a relationship (for messaging purposes)
    const { getAllRelationships } = await import('../utils/database-entities');
    const { getClientByEmail, getClientById } = await import('../utils/database-entities');
    const { findUserById: findUser } = await import('../utils/database');
    
    const allRelationships = await getAllRelationships();
    const currentUser = await findUser(userId);
    
    if (!currentUser) {
      return res.status(404).json({ error: { message: 'Current user not found' } });
    }
    
    // Check if users can message each other
    const targetUser = await findUserById(id);
    if (!targetUser) {
      return res.status(404).json({ error: { message: 'User not found' } });
    }
    
    let canAccess = false;
    
    if (currentUser.userType === 'stylist' && targetUser.userType === 'client') {
      // Stylist getting client info - check if they have relationship
      const client = await getClientByEmail(targetUser.email);
      if (client) {
        const relationship = allRelationships.find(
          r => r.stylistId === userId && r.clientId === client.id
        );
        canAccess = !!relationship;
      }
    } else if (currentUser.userType === 'client' && targetUser.userType === 'stylist') {
      // Client getting stylist info - check if they have relationship
      const client = await getClientByEmail(currentUser.email);
      if (client) {
        const relationship = allRelationships.find(
          r => r.stylistId === id && r.clientId === client.id
        );
        canAccess = !!relationship;
      }
    }
    
    if (!canAccess) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }
    
    const { password, ...userWithoutPassword } = targetUser;
    res.json({ data: userWithoutPassword });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * PUT /api/users/me
 * Update current user profile
 * 
 * SECURITY: userType is immutable - cannot be changed after user creation
 */
router.put('/me', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const updates = req.body;
    
    // Immutable fields: password, email, id, userType, createdAt, updatedAt
    // These fields cannot be changed through this endpoint (security)
    const { 
      password, 
      email, 
      id, 
      userType, 
      createdAt, 
      updatedAt,
      ...allowedUpdates 
    } = updates;
    
    // Warn if userType is attempted to be changed
    if (userType !== undefined) {
      console.warn(`⚠️ SECURITY: Attempt to change userType for user ${userId} blocked`);
      // Silently ignore - don't expose that this field exists
    }
    
    // Allowed fields: name, bio, location, profilePhotoUrl, phone
    const user = await updateUser(userId, allowedUpdates);
    
    if (!user) {
      return res.status(404).json({ error: { message: 'User not found' } });
    }
    
    // Don't send password hash
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({ data: userWithoutPassword });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

export default router;
