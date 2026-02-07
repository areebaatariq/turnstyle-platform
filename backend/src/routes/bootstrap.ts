import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import {
  getAllClients,
  getRelationshipsByStylist,
  getAllClosets,
  getAllClosetItems,
  getAllLooks,
  getAllLookItems,
  getChatRoomsWithDetails,
  getLookById,
  getClientById,
} from '../utils/database-entities';
import { findUserById } from '../utils/database';
import { getClientByEmail } from '../utils/database-entities';

const router = express.Router();
router.use(authenticateToken);

/**
 * GET /api/bootstrap
 * Load all core app data in a single request - eliminates multiple round trips
 * Returns: clients, closetBatch, looksWithItems, chatRooms
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const userType = req.userType!;

    // Load all raw data in parallel (single read per entity, uses cache)
    const [allClients, allClosets, allClosetItems, allLooks, allLookItems] = await Promise.all([
      getAllClients(),
      getAllClosets(),
      getAllClosetItems(),
      getAllLooks(),
      getAllLookItems(),
    ]);

    const relationships = await getRelationshipsByStylist(userId);
    const clientIds = new Set(relationships.map((r) => r.clientId));

    // 1. CLIENTS - same logic as GET /api/clients (stylist) or myClient (client user)
    let clients: any[] = [];
    let myClient: any = null;
    if (userType === 'stylist') {
      clients = allClients
        .filter((c) => clientIds.has(c.id))
        .map((client) => {
          const rel = relationships.find((r) => r.clientId === client.id);
          const status = rel?.status ?? 'not_active';
          const relationshipStatus =
            status === 'active' && rel?.acceptedAt ? 'active'
            : status === 'invited' ? 'invited'
            : status === 'ended' ? 'ended'
            : 'not_active';
          return { ...client, relationshipId: rel?.id, relationshipStatus };
        });
    } else {
      const user = await findUserById(userId);
      if (user) {
        const client = await getClientByEmail(user.email);
        if (client) myClient = client;
      }
    }

    // 2. CLOSET BATCH - total item count and first closet per client (stylist-scoped)
    const closetBatch: { clientId: string; closet: any; itemCount: number; totalItemCount: number }[] = [];
    if (userType === 'stylist' && clientIds.size > 0) {
      const closetIdToItems = new Map<string, typeof allClosetItems>();
      for (const item of allClosetItems) {
        if (!item.archived) {
          if (!closetIdToItems.has(item.closetId)) closetIdToItems.set(item.closetId, []);
          closetIdToItems.get(item.closetId)!.push(item);
        }
      }

      for (const clientId of clientIds) {
        const closets = allClosets.filter(
          (c) =>
            c.ownerId === clientId &&
            (c.stylistId === userId || (c.stylistId == null && c.createdBy === userId))
        );
        let totalItemCount = 0;
        for (const c of closets) {
          totalItemCount += (closetIdToItems.get(c.id) || []).length;
        }
        const firstCloset = closets[0] || null;
        closetBatch.push({
          clientId,
          closet: firstCloset,
          itemCount: totalItemCount,
          totalItemCount,
        });
      }
    }

    // 3. LOOKS WITH ITEMS - same logic as GET /api/looks/with-items
    const lookItemsByLookId = new Map<string, typeof allLookItems>();
    for (const item of allLookItems) {
      if (!lookItemsByLookId.has(item.lookId)) lookItemsByLookId.set(item.lookId, []);
      lookItemsByLookId.get(item.lookId)!.push(item);
    }
    const closetItemsById = new Map(allClosetItems.map((i) => [i.id, i]));
    const clientsById = new Map(allClients.map((c) => [c.id, c]));

    let filteredLooks: typeof allLooks;
    if (userType === 'stylist') {
      filteredLooks = allLooks.filter((l) => l.stylistId === userId);
    } else {
      const user = await findUserById(userId);
      if (!user) {
        return res.status(404).json({ error: { message: 'User not found' } });
      }
      const client = await getClientByEmail(user.email);
      if (!client) {
        filteredLooks = [];
      } else {
        filteredLooks = allLooks.filter(
          (l) => l.clientId === client.id && l.status !== 'draft'
        );
      }
    }

    const looksWithItems = filteredLooks.map((look) => {
      const lookItems = lookItemsByLookId.get(look.id) || [];
      const client = clientsById.get(look.clientId);
      const resolvedItems = lookItems.map((li) => {
        if (li.itemType === 'new_purchase' && li.newItemDetails) {
          return { ...li, closetItem: null, newItemDetails: li.newItemDetails };
        }
        const closetItem = closetItemsById.get(li.itemId);
        return { ...li, closetItem: closetItem || null };
      });
      return { ...look, client: client || null, items: resolvedItems };
    });

    // 4. CHAT ROOMS - stylist uses userId, client uses their client record id
    let chatRooms: any[] = [];
    try {
      let participantId = userId;
      if (userType === 'client') {
        const user = await findUserById(userId);
        if (user) {
          const client = await getClientByEmail(user.email);
          if (client) participantId = client.id;
        }
      }
      const rawChatRooms = await getChatRoomsWithDetails(participantId);
      // Enrich with look and client (from cache) for list display
      chatRooms = await Promise.all(
        rawChatRooms.map(async (cr) => {
          const [look, client, stylist] = await Promise.all([
            getLookById(cr.lookId),
            getClientById(cr.clientId),
            findUserById(cr.stylistId),
          ]);
          return {
            ...cr,
            look: look || undefined,
            clientName: client?.name || 'Unknown Client',
            clientPhoto: client?.profilePhotoUrl,
            stylistName: stylist?.name || 'Unknown Stylist',
            stylistPhoto: stylist?.profilePhotoUrl,
          };
        })
      );
    } catch {
      chatRooms = [];
    }

    res.json({
      data: {
        clients,
        myClient,
        closetBatch,
        looksWithItems,
        chatRooms,
      },
    });
  } catch (error: any) {
    console.error('Bootstrap error:', error);
    res.status(500).json({ error: { message: error.message || 'Bootstrap failed' } });
  }
});

export default router;
