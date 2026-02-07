import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { api } from '@/utils/api';
import { showError } from '@/utils/toast';
import { ClosetItem } from '@/types';
import { toFullSizeImageUrl } from '@/utils/fileUpload';
import { ItemImageWithPreview } from '@/components/ItemImagePreview';

interface RequestLookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  closetId: string;
  closetItems: ClosetItem[];
  clientId: string;
  onRequestSent: () => void;
}

export default function RequestLookDialog({
  open,
  onOpenChange,
  closetItems,
  clientId,
  onRequestSent,
}: RequestLookDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.size === 0) {
      showError('Please select at least one item');
      return;
    }
    setLoading(true);
    try {
      await api.post('/look-requests', {
        itemIds: Array.from(selectedIds),
        message: message.trim() || undefined,
      });
      onRequestSent();
      onOpenChange(false);
      setSelectedIds(new Set());
      setMessage('');
    } catch (err: any) {
      showError(err.message || 'Failed to send look request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request a Look</DialogTitle>
          <DialogDescription>
            Select items from your closet and send a request to your stylist to create a look.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Select items</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-2 mt-2 max-h-[280px] sm:max-h-[220px] overflow-y-auto p-1">
              {closetItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  className={`
                    relative rounded-lg border-2 overflow-hidden aspect-square
                    ${selectedIds.has(item.id) ? 'border-primary ring-2 ring-primary/30' : 'border-muted hover:border-muted-foreground/50'}
                  `}
                >
                  <div onClick={(e) => e.stopPropagation()} className="w-full h-full">
                    <ItemImageWithPreview
                      photoUrl={item.photoUrl}
                      alt={item.name}
                      caption={item.name}
                      className="w-full h-full object-contain bg-muted"
                    />
                  </div>
                  {selectedIds.has(item.id) && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                        ✓
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
            {closetItems.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">No items in your closet yet. Add items first.</p>
            )}
          </div>
          <div>
            <Label htmlFor="message">Message (optional)</Label>
            <Textarea
              id="message"
              placeholder="E.g. Weekend brunch outfit, or any notes for your stylist"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1"
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={selectedIds.size === 0 || loading}>
              {loading ? 'Sending...' : `Send Request (${selectedIds.size} item${selectedIds.size !== 1 ? 's' : ''})`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
