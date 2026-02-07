import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import {
  createLookRequest,
  getLookRequestsByStylist,
  getLookRequestsByClient,
  getLookRequestById,
  updateLookRequestStatus,
  getRelationshipsByClientId,
  getClientById,
  getClientByEmail,
  getClosetByOwnerId,
  getAllClosetItems,
} from '../utils/database-entities';
import { findUserById } from '../utils/database';
import { sendLookRequestEmail } from '../services/emailService';

const router = express.Router();
router.use(authenticateToken);

/**
 * POST /api/look-requests
 * Client creates a look request with selected closet items
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    if (req.userType !== 'client') {
      return res.status(403).json({ error: { message: 'Only clients can create look requests' } });
    }

    const { itemIds, message } = req.body;
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ error: { message: 'itemIds array with at least one item is required' } });
    }

    const { getClientByEmail } = await import('../utils/database-entities');
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ error: { message: 'User not found' } });
    const client = await getClientByEmail(user.email);
    if (!client) return res.status(404).json({ error: { message: 'Client record not found' } });

    const relationships = await getRelationshipsByClientId(client.id);
    const activeRel = relationships.find(r => r.status === 'active' || r.status === 'invited');
    if (!activeRel) {
      return res.status(400).json({ error: { message: 'No stylist relationship found. Accept an invitation first.' } });
    }

    const request = await createLookRequest(client.id, activeRel.stylistId, itemIds, message);

    // Send email to stylist
    try {
      const stylist = await findUserById(activeRel.stylistId);
      const closet = await getClosetByOwnerId(client.id);
      const allItems = closet ? await getAllClosetItems(closet.id) : [];
      const itemImages = itemIds
        .slice(0, 6)
        .map(id => allItems.find(i => i.id === id)?.photoUrl)
        .filter(Boolean) as string[];

      const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5137').replace(/\/$/, '');
      const requestLink = `${frontendUrl}/look-requests?requestId=${request.id}`;

      if (stylist?.email) {
        await sendLookRequestEmail({
          to: stylist.email,
          stylistName: stylist.name || 'Stylist',
          clientName: client.name,
          itemCount: itemIds.length,
          requestLink,
          itemImages,
        });
      }
    } catch (emailErr: any) {
      console.error('Failed to send look request email:', emailErr.message);
    }

    res.status(201).json({ data: request });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * GET /api/look-requests
 * Stylist: all look requests from their clients (enriched with client + items).
 * Client: their own look requests (enriched with item count; no client object needed).
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const userType = req.userType!;

    if (userType === 'stylist') {
      const requests = await getLookRequestsByStylist(userId);
      const enriched = await Promise.all(
        requests.map(async (r) => {
          const client = await getClientById(r.clientId);
          const closet = await getClosetByOwnerId(r.clientId);
          const allItems = closet ? await getAllClosetItems(closet.id) : [];
          const items = r.itemIds
            .map(id => allItems.find(i => i.id === id))
            .filter(Boolean);
          return { ...r, client: client || null, items };
        })
      );
      return res.json({ data: enriched });
    }

    if (userType === 'client') {
      const user = await findUserById(userId);
      if (!user) return res.status(404).json({ error: { message: 'User not found' } });
      const client = await getClientByEmail(user.email);
      if (!client) return res.json({ data: [] });
      const requests = await getLookRequestsByClient(client.id);
      const closet = await getClosetByOwnerId(client.id);
      const allItems = closet ? await getAllClosetItems(closet.id) : [];
      const enriched = requests.map((r) => {
        const items = r.itemIds
          .map((id) => allItems.find((i) => i.id === id))
          .filter(Boolean);
        return { ...r, items };
      });
      return res.json({ data: enriched });
    }

    return res.status(403).json({ error: { message: 'Access denied' } });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * PATCH /api/look-requests/:id
 * Update look request status.
 * Stylist: can set in_progress | completed | declined.
 * Client: can set declined only (cancel their own request).
 */
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.userId!;
    const userType = req.userType!;

    if (!status || !['in_progress', 'completed', 'declined'].includes(status)) {
      return res.status(400).json({ error: { message: 'status must be one of: in_progress, completed, declined' } });
    }

    const request = await getLookRequestById(id);
    if (!request) return res.status(404).json({ error: { message: 'Look request not found' } });

    if (userType === 'stylist') {
      if (request.stylistId !== userId) {
        return res.status(403).json({ error: { message: 'Access denied' } });
      }
    } else if (userType === 'client') {
      const user = await findUserById(userId);
      const client = user ? await getClientByEmail(user.email) : null;
      if (!client || request.clientId !== client.id) {
        return res.status(403).json({ error: { message: 'Access denied' } });
      }
      if (status !== 'declined') {
        return res.status(403).json({ error: { message: 'Clients can only decline (cancel) their own request' } });
      }
    } else {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }

    const updated = await updateLookRequestStatus(id, status);
    res.json({ data: updated });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * GET /api/look-requests/:id
 * Get a single look request (stylist only)
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    if (req.userType !== 'stylist') {
      return res.status(403).json({ error: { message: 'Only stylists can view look requests' } });
    }

    const request = await getLookRequestById(id);
    if (!request) return res.status(404).json({ error: { message: 'Look request not found' } });
    if (request.stylistId !== userId) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }

    const client = await getClientById(request.clientId);
    const closet = await getClosetByOwnerId(request.clientId);
    const allItems = closet ? await getAllClosetItems(closet.id) : [];
    const items = request.itemIds
      .map(id => allItems.find(i => i.id === id))
      .filter(Boolean);

    res.json({ data: { ...request, client: client || null, items } });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

export default router;
