import { useState, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, MessageSquare, Send, Edit, Trash2, Check, X, AlertCircle } from 'lucide-react';
import { getLookWithItems, updateLookStatus } from '@/utils/lookStorage';
import LookItemsCanvas, { CanvasItem } from '@/components/LookItemsCanvas';
import { showSuccess, showError } from '@/utils/toast';
import { getCurrentUser } from '@/utils/auth';
import { Look, Client, ClosetItem, LookItem, LookStatus } from '@/types';
import { format } from 'date-fns';

interface LookDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  look: Look | null;
  onDelete?: () => void;
  onSendForApproval?: () => void;
  onMessageClient?: () => void;
  onEdit?: () => void;
  onStatusChange?: () => void; // Callback when client changes look status
}

const LookDetailDialog = ({
  open,
  onOpenChange,
  look,
  onDelete,
  onSendForApproval,
  onMessageClient,
  onEdit,
  onStatusChange,
}: LookDetailDialogProps) => {
  const currentUser = getCurrentUser();
  const isClient = currentUser?.userType === 'client';
  const [client, setClient] = useState<Client | null>(null);
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [lookItems, setLookItems] = useState<LookItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const isMobile = useIsMobile();
  const canvasItemSize = isMobile ? 200 : 180;

  useEffect(() => {
    if (look) {
      loadLookDetails();
    }
  }, [look]);

  const loadLookDetails = async () => {
    if (!look) return;
    
    setLoading(true);
    try {
      // Use single endpoint that resolves items from the correct closet (stylist's for look building)
      // so client and stylist both see the same items without closet ID mismatch
      const result = await getLookWithItems(look.id);
      if (!result) {
        showError('Failed to load look details');
        setItems([]);
        setLookItems([]);
        setClient(null);
        return;
      }
      const { client: clientData, items: resolvedItems } = result;
      setClient(clientData ?? null);
      const lookItemsList = resolvedItems.map(({ closetItem: _c, newItemDetails: _n, ...lookItem }) => lookItem as LookItem);
      const closetItemsList = resolvedItems
        .map((r) => r.closetItem)
        .filter((c): c is ClosetItem => c != null);
      if (resolvedItems.length > 0 && closetItemsList.length === 0) {
        showError('Items in this look could not be found in your closet. They may have been removed.');
      }
      setLookItems(lookItemsList);
      setItems(closetItemsList);
    } catch (error: any) {
      console.error('Error loading look details:', error);
      showError(error?.message || error?.error?.message || 'Failed to load look details');
      setItems([]);
      setLookItems([]);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500">Pending Approval</Badge>;
      case 'approved':
        return <Badge className="bg-green-500">Approved</Badge>;
      case 'changes_requested':
        return <Badge className="bg-orange-500">Changes Requested</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleApproveLook = async () => {
    if (!look) return;
    
    setUpdatingStatus(true);
    try {
      await updateLookStatus(look.id, 'approved');
      showSuccess('Look approved!');
      onStatusChange?.();
      onOpenChange(false);
    } catch (error: any) {
      showError(error.message || 'Failed to approve look');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDeclineLook = async () => {
    if (!look) return;
    
    setUpdatingStatus(true);
    try {
      await updateLookStatus(look.id, 'changes_requested');
      showSuccess('Changes requested. Your stylist will be notified.');
      onStatusChange?.();
      onOpenChange(false);
    } catch (error: any) {
      showError(error.message || 'Failed to request changes');
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (!look) return null;

  const closetItemsMap = new Map(items.map((item) => [item.id, item]));
  const canvasItems: CanvasItem[] = lookItems
    .map((li) => {
      const closetItem = closetItemsMap.get(li.itemId);
      return closetItem ? { closetItem, lookItem: li } : null;
    })
    .filter((c): c is CanvasItem => c !== null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-2xl">{look.name}</DialogTitle>
              <DialogDescription className="mt-2">
                {client && (
                  <div className="flex items-center gap-3 mt-2">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={client.profilePhotoUrl} />
                      <AvatarFallback>{getInitials(client.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{client.name}</p>
                      <p className="text-sm text-muted-foreground">{client.email}</p>
                    </div>
                  </div>
                )}
              </DialogDescription>
            </div>
            {/* Status badge — right before close icon (in header flow, not absolute) */}
            <div className="flex-shrink-0">
              {getStatusBadge(look.status)}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Look Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {look.occasion && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Occasion</p>
                <p className="text-base">{look.occasion}</p>
              </div>
            )}
            {look.eventDate && (
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Event Date
                </p>
                <p className="text-base">{format(new Date(look.eventDate), 'MMM d, yyyy')}</p>
              </div>
            )}
          </div>

          {/* Styling Notes */}
          {look.stylingNotes && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Styling Notes</p>
              <p className="text-base whitespace-pre-wrap">{look.stylingNotes}</p>
            </div>
          )}

          {/* Composite image or Items layout */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-4">
              {look.compositeImageUrl ? 'Look' : `Items (${items.length})`}
            </p>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading items...</p>
            ) : look.compositeImageUrl ? (
              <div className="rounded-xl overflow-hidden border bg-white">
                <img
                  src={look.compositeImageUrl}
                  alt={look.name}
                  className="w-full h-auto object-contain max-h-[500px]"
                />
              </div>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items in this look</p>
            ) : (
              <LookItemsCanvas
                items={canvasItems}
                editable={false}
                itemSize={canvasItemSize}
                layout="horizontal"
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-4 border-t">
            {/* Client Actions - Approve/Decline */}
            {isClient && look.status === 'pending' && (
              <>
                <Button 
                  onClick={handleApproveLook} 
                  variant="default"
                  disabled={updatingStatus}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Approve Look
                </Button>
                <Button 
                  onClick={handleDeclineLook} 
                  variant="outline"
                  disabled={updatingStatus}
                  className="border-orange-500 text-orange-600 hover:bg-orange-50"
                >
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Request Changes
                </Button>
              </>
            )}
            
            {/* Stylist Actions - hidden for now */}
            {false && !isClient && (
              <>
                {look.status === 'draft' && onSendForApproval && (
                  <Button onClick={onSendForApproval} variant="default">
                    <Send className="mr-2 h-4 w-4" />
                    Send for Approval
                  </Button>
                )}
                {(look.status === 'draft' || look.status === 'changes_requested') && onEdit && (
                  <Button onClick={onEdit} variant="outline">
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Look
                  </Button>
                )}
                {onDelete && (
                  <Button onClick={onDelete} variant="destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                )}
              </>
            )}
            
            {/* Message Button - Both user types, only for non-draft looks */}
            {onMessageClient && look.status !== 'draft' && (
              <Button onClick={onMessageClient} variant="outline">
                <MessageSquare className="mr-2 h-4 w-4" />
                {isClient ? 'Message Stylist' : 'Message Client'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LookDetailDialog;
