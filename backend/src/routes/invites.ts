import express, { Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireStylist } from '../middleware/roleGuard';
import {
  getRelationshipById,
  updateRelationshipStatus,
  getClientById,
  createRelationship,
  getRelationshipsByStylist,
} from '../utils/database-entities';
import { findUserById } from '../utils/database';
import { sendInvitationEmail } from '../services/emailService';

const router = express.Router();

/**
 * POST /api/invites/send
 * Send invitation email to client
 * SECURITY: Stylist-only endpoint (enforced by middleware)
 */
router.post('/send', authenticateToken, requireStylist, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { clientId, clientEmail, clientName, customMessage } = req.body;

    // Validate required fields
    if (!clientId || !clientEmail || !clientName) {
      return res.status(400).json({ 
        error: { message: 'clientId, clientEmail, and clientName are required' } 
      });
    }

    // Get stylist info
    const stylist = await findUserById(userId);
    if (!stylist) {
      return res.status(404).json({ error: { message: 'Stylist not found' } });
    }

    // Check if client exists
    const client = await getClientById(clientId);
    if (!client) {
      return res.status(404).json({ error: { message: 'Client not found' } });
    }

    // Verify client email matches
    if (client.email.toLowerCase() !== clientEmail.toLowerCase()) {
      return res.status(400).json({ 
        error: { message: 'Client email does not match the provided email' } 
      });
    }

    // Check if relationship already exists between this stylist and client
    // NOTE: Multiple stylists CAN have relationships with the same client independently
    const existingRelationships = await getRelationshipsByStylist(userId);
    let relationship = existingRelationships.find(r => r.clientId === clientId);

    // Enforce invitation flow: do not send if already accepted or already pending
    if (relationship) {
      if (relationship.status === 'active') {
        return res.status(400).json({
          error: {
            message: 'This client has already accepted your invitation. No need to send another.',
          },
        });
      }
      if (relationship.status === 'invited') {
        return res.status(400).json({
          error: {
            message: 'An invitation is already pending. Wait for the client to respond or for the invitation to expire before sending again.',
          },
        });
      }
      // ended or not_active: allow sending (will update to 'invited')
    }

    // Create or update relationship with 'invited' status (only when not_active or ended)
    if (!relationship) {
      relationship = await createRelationship(userId, clientId, 'invited');
    } else {
      const updated = await updateRelationshipStatus(relationship.id, 'invited');
      if (updated) relationship = updated;
    }

    if (!relationship) {
      return res.status(500).json({ error: { message: 'Failed to create or update relationship' } });
    }

    // Generate invite link
    const frontendUrl = (process.env.FRONTEND_URL?.trim() || req.headers.origin || 'http://localhost:5137').replace(/\/$/, '');
    const inviteLink = `${frontendUrl}/invite/${relationship.id}`;

    // Send invitation email
    try {
      console.log('📨 Sending invitation email for client:', clientEmail);
      await sendInvitationEmail({
        to: clientEmail,
        clientName: clientName || client.name,
        stylistName: stylist.name,
        inviteLink,
        customMessage,
      });

      console.log('✅ Invitation email sent successfully to:', clientEmail);
      res.json({ 
        message: 'Invitation sent successfully'
      });
    } catch (emailError: any) {
      console.error('❌ Failed to send invitation email:', emailError);
      console.error('   Error details:', emailError.message);
      return res.status(500).json({ 
        message: emailError.message || 'Failed to send invitation',
        error: emailError.message
      });
    }
  } catch (error: any) {
    console.error('Error sending invitation:', error);
    res.status(500).json({ 
      message: 'Failed to send invitation'
    });
  }
});

/**
 * GET /api/invites/:relationshipId
 * Get invite details (public route, no auth required)
 */
router.get('/:relationshipId', async (req: Request, res: Response) => {
  try {
    const { relationshipId } = req.params;

    const relationship = await getRelationshipById(relationshipId);
    if (!relationship) {
      return res.status(404).json({ error: { message: 'Invitation not found' } });
    }

    // Don't expose if already accepted or ended
    if (relationship.status !== 'invited') {
      return res.status(400).json({
        error: {
          message: `This invitation has already been ${relationship.status === 'active' ? 'accepted' : 'ended'}`,
        },
      });
    }

    // Check if invitation has expired (7 days)
    if (relationship.expiresAt) {
      const expiresAt = new Date(relationship.expiresAt);
      const now = new Date();
      
      if (now > expiresAt) {
        return res.status(410).json({
          error: {
            message: 'This invitation has expired. Please request a new invitation from your stylist.',
          },
        });
      }
    }

    // Get stylist info
    const stylist = await findUserById(relationship.stylistId);
    if (!stylist) {
      return res.status(404).json({ error: { message: 'Stylist not found' } });
    }

    // Get client info
    const client = await getClientById(relationship.clientId);
    if (!client) {
      return res.status(404).json({ error: { message: 'Client not found' } });
    }

    // Return invite details (without sensitive info)
    res.json({
      data: {
        relationshipId: relationship.id,
        stylistName: stylist.name,
        stylistEmail: stylist.email,
        stylistProfilePhoto: stylist.profilePhotoUrl,
        clientName: client.name,
        clientEmail: client.email,
        status: relationship.status,
        createdAt: relationship.createdAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * POST /api/invites/:relationshipId/accept
 * Accept an invitation
 * For MVP: accepts userId from body or email from body
 * In production: would use authenticateToken middleware
 */
router.post('/:relationshipId/accept', async (req: Request, res: Response) => {
  try {
    const { relationshipId } = req.params;
    const { userId, email } = req.body;

    const relationship = await getRelationshipById(relationshipId);
    if (!relationship) {
      return res.status(404).json({ error: { message: 'Invitation not found' } });
    }

    if (relationship.status !== 'invited') {
      return res.status(400).json({
        error: {
          message: `This invitation has already been ${relationship.status === 'active' ? 'accepted' : 'ended'}`,
        },
      });
    }

    // Check if invitation has expired (7 days)
    if (relationship.expiresAt) {
      const expiresAt = new Date(relationship.expiresAt);
      const now = new Date();
      
      if (now > expiresAt) {
        return res.status(410).json({
          error: {
            message: 'This invitation has expired. Please request a new invitation from your stylist.',
          },
        });
      }
    }

    // NOTE: Multiple stylists CAN have relationships with the same client independently

    // Get client info
    const client = await getClientById(relationship.clientId);
    if (!client) {
      return res.status(404).json({ error: { message: 'Client not found' } });
    }

    // Validate user identity (userId or email must match client)
    if (userId) {
      const user = await findUserById(userId);
      if (!user) {
        return res.status(404).json({ error: { message: 'User not found' } });
      }

      // Verify user email matches client email
      if (user.email.toLowerCase() !== client.email.toLowerCase()) {
        return res.status(403).json({
          error: {
            message: 'You can only accept invitations sent to your email address',
          },
        });
      }
    } else if (email) {
      // Validate email matches client email
      if (email.toLowerCase() !== client.email.toLowerCase()) {
        return res.status(403).json({
          error: {
            message: 'You can only accept invitations sent to your email address',
          },
        });
      }
    } else {
      // For MVP, allow accepting without auth if email matches
      // In production, this should require authentication
    }

    // Update relationship to active (acceptedAt will be set automatically)
    const updatedRelationship = await updateRelationshipStatus(relationshipId, 'active');

    res.json({
      data: {
        success: true,
        relationship: updatedRelationship,
        message: 'Invitation accepted successfully',
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * POST /api/invites/:relationshipId/decline
 * Decline an invitation (no auth required for MVP – anyone with the link can decline)
 * Sets relationship status to 'ended' so the stylist dashboard shows the update.
 */
router.post('/:relationshipId/decline', async (req: Request, res: Response) => {
  try {
    const { relationshipId } = req.params;

    const relationship = await getRelationshipById(relationshipId);
    if (!relationship) {
      return res.status(404).json({ error: { message: 'Invitation not found' } });
    }

    if (relationship.status !== 'invited') {
      return res.status(400).json({
        error: {
          message: `This invitation has already been ${relationship.status === 'active' ? 'accepted' : 'ended'}`,
        },
      });
    }

    await updateRelationshipStatus(relationshipId, 'ended');

    res.json({
      data: {
        success: true,
        message: 'Invitation declined',
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

export default router;
