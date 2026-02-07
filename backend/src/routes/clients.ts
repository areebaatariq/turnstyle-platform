import express, { Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import {
  getAllClients as getClients,
  getClientById,
  getClientByEmail,
  createClient,
  updateClient,
  deleteClient,
  bulkCreateClients,
} from '../utils/database-entities';
import { getRelationshipsByStylist } from '../utils/database-entities';
import { Client } from '../types';

const router = express.Router();

/** Optional fields that can be updated from the style form (same as client optional fields) */
const FORM_RESPONSE_FIELDS: (keyof Client)[] = [
  'featuresYouLove', 'wardrobeColors', 'personalStyle', 'dailySchedule',
  'featuresYouDislike', 'styleIcons', 'styleIconsDescription', 'additionalStyleInfo',
  'instagramHandle', 'outfitsPerDayEstimate', 'weekdayOutfitDetails',
];

/**
 * POST /api/clients/form-response
 * Webhook for Google Form (or other) style questionnaire submissions.
 * Matches submission by client email and merges responses into the client record.
 * Protected by FORM_WEBHOOK_SECRET (x-api-key header) when set.
 */
router.post('/form-response', async (req: Request, res: Response) => {
  try {
    const secret = process.env.FORM_WEBHOOK_SECRET;
    if (secret) {
      const apiKey = req.headers['x-api-key'] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
      if (apiKey !== secret) {
        return res.status(401).json({ error: { message: 'Invalid or missing API key' } });
      }
    }

    const body = req.body as Record<string, unknown>;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email) {
      return res.status(400).json({ error: { message: 'email is required' } });
    }

    const client = await getClientByEmail(email);
    if (!client) {
      return res.status(404).json({ error: { message: 'No client found with this email' } });
    }

    const updates: Partial<Client> = {};
    for (const key of FORM_RESPONSE_FIELDS) {
      const value = body[key];
      if (typeof value === 'string' && value.trim() !== '') {
        (updates as Record<string, string>)[key] = value.trim();
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.json({ data: { updated: false, message: 'No fields to update' } });
    }

    const updated = await updateClient(client.id, updates);
    if (!updated) {
      return res.status(500).json({ error: { message: 'Failed to update client' } });
    }

    return res.json({
      data: {
        updated: true,
        clientId: updated.id,
        message: 'Client profile updated from form response',
      },
    });
  } catch (error: any) {
    console.error('Form response webhook error:', error);
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
});

// All other routes require authentication
router.use(authenticateToken);

/**
 * GET /api/clients/me
 * Get the current user's client record (client users only)
 * Must be before /:id to avoid "me" being parsed as id
 */
router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    if (req.userType !== 'client') {
      return res.status(403).json({ error: { message: 'Only client users can access this endpoint' } });
    }
    const { findUserById } = await import('../utils/database');
    const { getClientByEmail } = await import('../utils/database-entities');
    const user = await findUserById(req.userId!);
    if (!user) return res.status(404).json({ error: { message: 'User not found' } });
    const client = await getClientByEmail(user.email);
    if (!client) return res.status(404).json({ error: { message: 'Client record not found' } });
    res.json({ data: client });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * GET /api/clients
 * Get all clients for the authenticated stylist
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const stylistId = req.userId!;
    
    // Get all relationships for this stylist
    const relationships = await getRelationshipsByStylist(stylistId);
    
    // Get all clients that are in relationships
    const allClients = await getClients();
    const clientIds = new Set(relationships.map(r => r.clientId));
    
    // Only show "active" when the client has accepted the invite (acceptedAt set). Otherwise "invited" or "not_active".
    const clients = allClients
      .filter(client => clientIds.has(client.id))
      .map(client => {
        const relationship = relationships.find(r => r.clientId === client.id);
        const status = relationship?.status ?? 'not_active';
        const relationshipStatus =
          status === 'active' && relationship?.acceptedAt ? 'active'
          : status === 'invited' ? 'invited'
          : status === 'ended' ? 'ended'
          : 'not_active';
        return {
          ...client,
          relationshipId: relationship?.id,
          relationshipStatus,
        };
      });

    res.json({ data: clients });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * GET /api/clients/:id
 * Get a specific client by ID
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    
    const client = await getClientById(id);
    if (!client) {
      return res.status(404).json({ error: { message: 'Client not found' } });
    }
    
    // Check access based on user type
    if (req.userType === 'stylist') {
      // Stylists can only see clients they have a relationship with
      const relationships = await getRelationshipsByStylist(userId);
      const hasRelationship = relationships.some(r => r.clientId === id);
      
      if (!hasRelationship) {
        return res.status(403).json({ error: { message: 'Access denied' } });
      }
      
      const relationship = relationships.find(r => r.clientId === id);
      const status = relationship?.status ?? 'not_active';
      const relationshipStatus =
        status === 'active' && relationship?.acceptedAt ? 'active'
        : status === 'invited' ? 'invited'
        : status === 'ended' ? 'ended'
        : 'not_active';
      return res.json({
        data: {
          ...client,
          relationshipId: relationship?.id,
          relationshipStatus,
        },
      });
    } else {
      // Clients can access their own client record (by matching email)
      const { findUserById } = await import('../utils/database');
      const { getClientByEmail } = await import('../utils/database-entities');
      
      const user = await findUserById(userId);
      if (!user) {
        return res.status(404).json({ error: { message: 'User not found' } });
      }
      
      const clientByEmail = await getClientByEmail(user.email);
      if (!clientByEmail || clientByEmail.id !== id) {
        return res.status(403).json({ error: { message: 'Access denied' } });
      }
      
      // Return client data without relationship info for clients
      return res.json({
        data: client,
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * POST /api/clients
 * Create a new client (or link existing client to this stylist)
 * 
 * IMPORTANT: Clients are scoped per stylist through relationships.
 * If a client email exists globally but isn't linked to THIS stylist,
 * we create a new relationship rather than blocking.
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const stylistId = req.userId!;
    const clientData = req.body;
    
    // Validate required fields
    if (!clientData.name || !clientData.email) {
      return res.status(400).json({ error: { message: 'Name and email are required' } });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientData.email)) {
      return res.status(400).json({ error: { message: 'Invalid email format' } });
    }
    
    // Normalize email to lowercase
    clientData.email = clientData.email.toLowerCase().trim();
    
    // Import required functions
    const { getClientByEmail, getRelationshipByStylistAndClient, createRelationship, updateClient } = await import('../utils/database-entities');
    
    // Check if client with this email already exists globally
    const existingClient = await getClientByEmail(clientData.email);
    
    if (existingClient) {
      // Client exists - check if THIS stylist already has a relationship with them
      const existingRelationship = await getRelationshipByStylistAndClient(stylistId, existingClient.id);
      
      if (existingRelationship && existingRelationship.status !== 'ended') {
        // Stylist already has this client - error
        return res.status(409).json({ 
          error: { 
            message: `You already have a client with email "${clientData.email}".` 
          } 
        });
      }
      
      // Client exists but not linked to THIS stylist - create relationship
      // Also update client info with any new data provided
      const updatedClient = await updateClient(existingClient.id, {
        name: clientData.name,
        phone: clientData.phone ?? existingClient.phone,
        sizeTop: clientData.sizeTop ?? existingClient.sizeTop,
        sizeBottom: clientData.sizeBottom ?? existingClient.sizeBottom,
        sizeDress: clientData.sizeDress ?? existingClient.sizeDress,
        sizeShoes: clientData.sizeShoes ?? existingClient.sizeShoes,
        braSize: clientData.braSize ?? existingClient.braSize,
        colorPreferences: clientData.colorPreferences ?? existingClient.colorPreferences,
        profilePhotoUrl: clientData.profilePhotoUrl ?? existingClient.profilePhotoUrl,
        featuresYouLove: clientData.featuresYouLove ?? existingClient.featuresYouLove,
        wardrobeColors: clientData.wardrobeColors ?? existingClient.wardrobeColors,
        personalStyle: clientData.personalStyle ?? existingClient.personalStyle,
        dailySchedule: clientData.dailySchedule ?? existingClient.dailySchedule,
        featuresYouDislike: clientData.featuresYouDislike ?? existingClient.featuresYouDislike,
        styleIcons: clientData.styleIcons ?? existingClient.styleIcons,
        styleIconsDescription: clientData.styleIconsDescription ?? existingClient.styleIconsDescription,
        additionalStyleInfo: clientData.additionalStyleInfo ?? existingClient.additionalStyleInfo,
        instagramHandle: clientData.instagramHandle ?? existingClient.instagramHandle,
        outfitsPerDayEstimate: clientData.outfitsPerDayEstimate ?? existingClient.outfitsPerDayEstimate,
        weekdayOutfitDetails: clientData.weekdayOutfitDetails ?? existingClient.weekdayOutfitDetails,
      });
      
      let relationship;
      try {
        relationship = await createRelationship(stylistId, existingClient.id, 'not_active');
      } catch (relError: any) {
        // If relationship creation fails (e.g., client has active relationship with another stylist)
        return res.status(409).json({ 
          error: { 
            message: relError.message || 'Failed to link client to your account.' 
          } 
        });
      }
      
      const clientWithRel = { ...(updatedClient || existingClient), relationshipId: relationship.id, relationshipStatus: 'not_active' as const };
      return res.status(201).json({ data: clientWithRel });
    }
    
    // Client doesn't exist - create new client
    const client = await createClient(clientData);
    
    // Create relationship with 'not_active' - becomes Active when client accepts invite or approves/changes a look
    const relationship = await createRelationship(stylistId, client.id, 'not_active');
    
    const clientWithRel = { ...client, relationshipId: relationship.id, relationshipStatus: 'not_active' as const };
    res.status(201).json({ data: clientWithRel });
  } catch (error: any) {
    console.error('Error creating client:', error);
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * POST /api/clients/bulk
 * Bulk create clients
 */
router.post('/bulk', async (req: AuthRequest, res: Response) => {
  try {
    const stylistId = req.userId!;
    const clientsData = req.body.clients || req.body;
    
    if (!Array.isArray(clientsData) || clientsData.length === 0) {
      return res.status(400).json({ error: { message: 'Array of clients is required' } });
    }
    
    // Validate all clients have required fields and valid email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const clientData of clientsData) {
      if (!clientData.name || !clientData.email) {
        return res.status(400).json({ error: { message: 'All clients must have name and email' } });
      }
      
      // Validate email format
      if (!emailRegex.test(clientData.email)) {
        return res.status(400).json({ error: { message: `Invalid email format: ${clientData.email}` } });
      }
    }
    
    // Create all clients (will skip duplicates)
    const { getClientByEmail } = await import('../utils/database-entities');
    const { createRelationship } = await import('../utils/database-entities');
    const { getRelationshipsByStylist } = await import('../utils/database-entities');
    
    const newClients = await bulkCreateClients(clientsData);
    const existingRelationships = await getRelationshipsByStylist(stylistId);
    const existingClientIds = new Set(existingRelationships.map(r => r.clientId));
    
    console.log(`📊 Bulk import stats: ${clientsData.length} in CSV, ${newClients.length} newly created, ${existingClientIds.size} already have relationships`);
    
    // Collect all unique clients to link (deduplicate by client ID)
    const clientsToLinkMap = new Map<string, { id: string; email: string }>();
    
    // Add newly created clients
    newClients.forEach(client => {
      clientsToLinkMap.set(client.id, { id: client.id, email: client.email });
    });
    
    // Find existing clients that were skipped and need relationships
    // Use a Set to track emails we've already checked to avoid duplicate checks
    const checkedEmails = new Set<string>();
    for (const clientData of clientsData) {
      const emailLower = clientData.email.toLowerCase().trim();
      
      // Skip if we already checked this email
      if (checkedEmails.has(emailLower)) {
        continue;
      }
      checkedEmails.add(emailLower);
      
      const existingClient = await getClientByEmail(emailLower);
      
      if (existingClient && !existingClientIds.has(existingClient.id) && !clientsToLinkMap.has(existingClient.id)) {
        // Client exists but doesn't have a relationship with this stylist yet
        clientsToLinkMap.set(existingClient.id, { id: existingClient.id, email: existingClient.email });
        console.log(`➕ Adding existing client ${existingClient.email} to link list`);
      }
    }
    
    const allClientsToLink = Array.from(clientsToLinkMap.values());
    console.log(`📋 Total clients to link: ${allClientsToLink.length}`);
    
    if (allClientsToLink.length === 0 && newClients.length === 0) {
      return res.status(200).json({ 
        data: [],
        message: 'No new clients created. All clients already exist and are already linked to you.',
        skipped: clientsData.length
      });
    }
    
    // Create relationships sequentially to avoid race conditions when reading/writing the file
    // This ensures each relationship creation reads the most up-to-date state
    const successfulRelationships: any[] = [];
    const relationshipFailures: Array<{ client: { id: string; email: string }; error: any }> = [];
    
    for (const client of allClientsToLink) {
      try {
        console.log(`🔗 Creating relationship for client ${client.id} (${client.email})`);
        const relationship = await createRelationship(stylistId, client.id, 'not_active');
        successfulRelationships.push(relationship);
      } catch (error: any) {
        console.error(`❌ Failed to create relationship for ${client.email}:`, error.message);
        relationshipFailures.push({ client, error });
      }
    }
    
    if (relationshipFailures.length > 0) {
      console.error(`❌ Failed to create ${relationshipFailures.length} relationship(s) during bulk import`);
      relationshipFailures.forEach(({ client, error }) => {
        console.error(`   Failed for client: ${client.email} - ${error.message || error}`);
      });
    }
    
    const totalLinked = successfulRelationships.length;
    const newlyCreated = newClients.length;
    const alreadyExisted = allClientsToLink.length - newClients.length;
    
    console.log(`✅ Bulk import summary:`);
    console.log(`   - Newly created clients: ${newlyCreated}`);
    console.log(`   - Existing clients to link: ${alreadyExisted}`);
    console.log(`   - Relationships successfully created: ${totalLinked}`);
    console.log(`   - Relationship creation failures: ${relationshipFailures.length}`);
    
    if (totalLinked === 0) {
      return res.status(400).json({
        error: {
          message: `Failed to create relationships for any clients. Please check the console for details.`,
        },
      });
    }
    
    // Return only clients that successfully got relationships
    const successfullyLinkedClients = allClientsToLink.filter((client, index) => {
      // Find if this client's relationship creation succeeded
      return successfulRelationships.some(rel => rel.clientId === client.id);
    });
    
    res.status(201).json({ 
      data: successfullyLinkedClients,
      message: `Successfully imported ${newlyCreated} new client(s) and linked ${alreadyExisted} existing client(s). ${totalLinked} client(s) now available.`,
      newlyCreated,
      alreadyExisted,
      successfullyLinked: totalLinked,
      failed: relationshipFailures.length,
      skipped: clientsData.length - allClientsToLink.length
    });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * PUT /api/clients/:id
 * Update a client
 */
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const stylistId = req.userId!;
    
    // Check if stylist has relationship with this client
    const relationships = await getRelationshipsByStylist(stylistId);
    const hasRelationship = relationships.some(r => r.clientId === id);
    
    if (!hasRelationship) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }
    
    const updatedClient = await updateClient(id, req.body);
    if (!updatedClient) {
      return res.status(404).json({ error: { message: 'Client not found' } });
    }
    
    res.json({ data: updatedClient });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * DELETE /api/clients/:id
 * Delete a client
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const stylistId = req.userId!;
    
    // Check if stylist has relationship with this client
    const relationships = await getRelationshipsByStylist(stylistId);
    const hasRelationship = relationships.some(r => r.clientId === id);
    
    if (!hasRelationship) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }
    
    const deleted = await deleteClient(id);
    if (!deleted) {
      return res.status(404).json({ error: { message: 'Client not found' } });
    }
    
    // Also delete relationships (in a real app, you'd handle this with foreign keys)
    const { getAllRelationships, updateRelationshipStatus } = await import('../utils/database-entities');
    const allRelationships = await getAllRelationships();
    const clientRelationships = allRelationships.filter(r => r.clientId === id);
    await Promise.all(
      clientRelationships.map(r => updateRelationshipStatus(r.id, 'ended'))
    );
    
    res.json({ data: { success: true } });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * DELETE /api/clients
 * Delete all clients for the authenticated stylist
 */
router.delete('/', async (req: AuthRequest, res: Response) => {
  try {
    const stylistId = req.userId!;
    
    // Get all relationships for this stylist
    const relationships = await getRelationshipsByStylist(stylistId);
    const clientIds = new Set(relationships.map(r => r.clientId));
    
    if (clientIds.size === 0) {
      return res.json({ data: { success: true, deletedCount: 0, message: 'No clients to delete' } });
    }
    
    // Delete all clients that have relationships with this stylist
    const { getAllClients, deleteClient } = await import('../utils/database-entities');
    const allClients = await getAllClients();
    const clientsToDelete = allClients.filter(c => clientIds.has(c.id));
    
    let deletedCount = 0;
    const deleteErrors: string[] = [];
    
    for (const client of clientsToDelete) {
      try {
        const deleted = await deleteClient(client.id);
        if (deleted) {
          deletedCount++;
        }
      } catch (error: any) {
        deleteErrors.push(`Failed to delete ${client.email}: ${error.message}`);
      }
    }
    
    // Also end all relationships
    const { getAllRelationships, updateRelationshipStatus } = await import('../utils/database-entities');
    const allRelationships = await getAllRelationships();
    const stylistRelationships = allRelationships.filter(r => r.stylistId === stylistId);
    
    await Promise.all(
      stylistRelationships.map(r => updateRelationshipStatus(r.id, 'ended').catch(() => null))
    );
    
    if (deleteErrors.length > 0) {
      console.error('Some clients could not be deleted:', deleteErrors);
    }
    
    res.json({ 
      data: { 
        success: true, 
        deletedCount,
        totalClients: clientsToDelete.length,
        errors: deleteErrors.length > 0 ? deleteErrors : undefined
      } 
    });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

export default router;
