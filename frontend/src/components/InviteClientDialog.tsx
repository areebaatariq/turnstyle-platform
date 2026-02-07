import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Mail, MessageSquare } from 'lucide-react';
import { getRelationships } from '@/utils/clientStorage';
import { sendInvitationEmail } from '@/utils/inviteApi';
import { showSuccess, showError } from '@/utils/toast';
import { Client } from '@/types';

interface InviteClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  onInviteSent: () => void;
}

const InviteClientDialog = ({
  open,
  onOpenChange,
  client,
  onInviteSent,
}: InviteClientDialogProps) => {
  const [inviteMethod, setInviteMethod] = useState<'email' | 'sms' | 'whatsapp'>('email');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [existingRelationship, setExistingRelationship] = useState<string | null>(null);

  useEffect(() => {
    if (client) {
      // Generate default message
      const defaultMessage = `Hi ${client.name},\n\nI'd like to invite you to join my styling platform. You'll be able to view your closet, receive styling recommendations, and collaborate with me.\n\nClick the link below to accept the invitation and create your account.\n\nLooking forward to working with you!`;
      setMessage(defaultMessage);

      // Check if relationship already exists
      const loadRelationships = async () => {
        try {
          const relationships = await getRelationships();
          const relationship = relationships.find(
            r => r.clientId === client.id
          );
          
          if (relationship) {
            setExistingRelationship(relationship.id);
          } else {
            setExistingRelationship(null);
          }
        } catch (error) {
          console.error('Error loading relationships:', error);
        }
      };
      
      loadRelationships();
    }
  }, [client]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🚀 InviteClientDialog: handleSubmit called');
    console.log('   inviteMethod:', inviteMethod);
    console.log('   inviteMethod type:', typeof inviteMethod);
    console.log('   inviteMethod === "email":', inviteMethod === 'email');
    console.log('   client:', client?.name, client?.email);
    console.log('   message length:', message.trim().length);

    if (!client) {
      console.error('❌ No client selected');
      showError('No client selected');
      return;
    }

    if (!message.trim()) {
      console.error('❌ No message provided');
      showError('Please enter a message');
      return;
    }

    setLoading(true);
    console.log('✅ Validation passed, starting invitation send...');
    console.log('   About to check inviteMethod...');
    console.log('   inviteMethod value:', JSON.stringify(inviteMethod));
    console.log('   Checking if inviteMethod === "email"...');

    try {
      if (inviteMethod === 'email') {
        console.log('📧 InviteClientDialog: Email method selected, calling API...');
        console.log('   Client ID:', client.id);
        console.log('   Client Email:', client.email);
        console.log('   Client Name:', client.name);
        
        // Send email invitation via API
        if (!client.email) {
          console.error('❌ Client email is missing!');
          throw new Error('Client email is required for email invitations');
        }
        
        console.log('📤 About to call sendInvitationEmail...');
        console.log('   Parameters being sent:', {
          clientId: client.id,
          clientEmail: client.email,
          clientName: client.name,
          hasCustomMessage: !!message.trim(),
        });
        
        try {
          const response = await sendInvitationEmail({
            clientId: client.id,
            clientEmail: client.email,
            clientName: client.name,
            customMessage: message.trim(),
          });

          console.log('✅ InviteClientDialog: Email sent successfully:', response);
          showSuccess(`Invitation email sent successfully to ${client.email}`);
        } catch (emailError: any) {
          console.error('❌ InviteClientDialog: Error from sendInvitationEmail:', emailError);
          throw emailError; // Re-throw to be caught by outer catch
        }
      } else if (inviteMethod === 'whatsapp' || inviteMethod === 'sms') {
        console.log('📱 InviteClientDialog: WhatsApp/SMS method selected');
        // WhatsApp: Still use relationship creation (no email API)
        if (!client.phone) {
          console.error('❌ No phone number for WhatsApp/SMS');
          showError('Client phone number is required for WhatsApp invitations');
          setLoading(false);
          return;
        }

        // For WhatsApp, we still need to create/update the relationship
        // Then generate a WhatsApp link (MVP approach)
        const { createRelationship, updateRelationshipStatus } = await import('@/utils/clientStorage');
        let relationshipId: string;

        if (existingRelationship) {
          const updated = await updateRelationshipStatus(existingRelationship, 'invited');
          if (!updated) {
            throw new Error('Failed to update relationship');
          }
          relationshipId = existingRelationship;
        } else {
          const relationship = await createRelationship(client.id, 'invited');
          relationshipId = relationship.id;
        }

        const inviteLink = `${window.location.origin}/invite/${relationshipId}`;
        const whatsappLink = `https://wa.me/${client.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`${message}\n\nJoin here: ${inviteLink}`)}`;
        showSuccess(`WhatsApp invitation link generated. Open: ${whatsappLink}`);
        // Optionally open WhatsApp in new tab
        window.open(whatsappLink, '_blank');
      } else {
        console.error('❌ Unknown invite method:', inviteMethod);
        throw new Error(`Unknown invitation method: ${inviteMethod}`);
      }

      handleReset();
      onOpenChange(false);
      // Use requestAnimationFrame to ensure state updates complete before calling callback
      requestAnimationFrame(() => {
        onInviteSent();
      });
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      const errorMessage = error?.message || error?.error?.message || 'Failed to send invitation';
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setInviteMethod('email');
    setMessage('');
    setExistingRelationship(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      handleReset();
    }
    onOpenChange(newOpen);
  };

  if (!client) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[80vw] min-w-0 max-w-[min(500px,calc(100vw-2rem))] rounded-lg overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Send Invitation</DialogTitle>
          <DialogDescription>
            Send an invitation to {client.name} to join the platform.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 min-w-0">
          <div className="p-4 border rounded-md bg-white min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <Label>Client</Label>
              {client?.relationshipStatus === 'active' && (
                <Badge className="bg-green-600 shrink-0">Already active</Badge>
              )}
              {client?.relationshipStatus === 'invited' && (
                <Badge variant="secondary" className="shrink-0">Invitation pending</Badge>
              )}
            </div>
            <p className="font-medium break-words">{client.name}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground min-w-0">
              <div className="flex items-center gap-1 min-w-0">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="break-all">{client.email}</span>
              </div>
              {client.phone && (
                <div className="flex items-center gap-1 min-w-0">
                  <MessageSquare className="h-3 w-3 shrink-0" />
                  <span className="break-all">{client.phone}</span>
                </div>
              )}
            </div>
          </div>

          {client?.relationshipStatus === 'active' && (
            <p className="text-sm text-muted-foreground p-3 bg-muted rounded-md break-words">
              This client has already accepted your invitation. You cannot send another.
            </p>
          )}
          {client?.relationshipStatus === 'invited' && (
            <p className="text-sm text-muted-foreground p-3 bg-muted rounded-md break-words">
              An invitation is already pending. Wait for the client to respond or for it to expire before sending again.
            </p>
          )}

          <div className="space-y-3 min-w-0">
            <Label>Invitation Method</Label>
            <RadioGroup value={inviteMethod} onValueChange={(value) => {
              console.log('🔵 InviteClientDialog: Invite method changed to:', value);
              console.log('   Previous value:', inviteMethod);
              setInviteMethod(value as 'email' | 'sms' | 'whatsapp');
            }}>
              <div className="flex items-center gap-2 min-w-0">
                <RadioGroupItem value="email" id="email" className="shrink-0" />
                <Label
                  htmlFor="email"
                  className={`cursor-pointer text-sm whitespace-nowrap overflow-hidden text-ellipsis min-w-0 ${inviteMethod === 'email' ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}
                >
                  Email ({client.email})
                </Label>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <RadioGroupItem value="sms" id="sms" disabled={!client.phone} className="shrink-0" />
                <Label
                  htmlFor="sms"
                  className={`cursor-pointer text-sm whitespace-nowrap overflow-hidden text-ellipsis min-w-0 ${inviteMethod === 'sms' ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}
                >
                  SMS ({client.phone || 'No phone number'})
                </Label>
              </div>
            </RadioGroup>
            {inviteMethod === 'sms' && !client.phone && (
              <p className="text-xs text-muted-foreground">
                Phone number is required for SMS invitations
              </p>
            )}
          </div>

          <div className="space-y-2 min-w-0">
            <Label htmlFor="message">Personal Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter a personalized message..."
              rows={6}
              required
              className="min-w-0 w-full max-w-full"
            />
            <p className="text-xs text-muted-foreground break-words">
              A magic link will be automatically included in your invitation.
            </p>
            <p className="text-xs text-muted-foreground mt-1 break-words">
              The email will also include a link to an optional style questionnaire. When the client submits it, their answers are synced to this client&apos;s profile.
            </p>
          </div>

          <DialogFooter className="flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                loading ||
                client?.relationshipStatus === 'active' ||
                client?.relationshipStatus === 'invited' ||
                ((inviteMethod === 'whatsapp' || inviteMethod === 'sms') && !client?.phone)
              }
            >
              {loading ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default InviteClientDialog;
