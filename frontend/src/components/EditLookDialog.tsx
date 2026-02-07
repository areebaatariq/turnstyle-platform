import { useState, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  updateLook,
  getLookItemsByLookId,
  removeItemFromLook,
  updateLookItem,
  bulkAddItemsToLook,
} from '@/utils/lookStorage';
import { getOrCreateCloset, getClientCloset, getClosetItems } from '@/utils/closetStorage';
import { showSuccess, showError } from '@/utils/toast';
import { Look, ClosetItem, LookItem } from '@/types';
import LookComposer, { LookComposerItem, generateLookCompositeImage } from '@/components/LookComposer';

interface EditLookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  look: Look | null;
  /** Callback to refresh look data; may be async. Dialog awaits it before closing so UI updates. */
  onLookUpdated: () => void | Promise<void>;
}

const EditLookDialog = ({
  open,
  onOpenChange,
  look,
  onLookUpdated,
}: EditLookDialogProps) => {
  const [name, setName] = useState('');
  const [occasion, setOccasion] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [stylingNotes, setStylingNotes] = useState('');
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [lookItemRecords, setLookItemRecords] = useState<LookItem[]>([]);
  const [composerItems, setComposerItems] = useState<LookComposerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const isMobile = useIsMobile();
  const composerItemSize = isMobile ? 140 : 110;

  useEffect(() => {
    if (look && open) {
      setLoading(false);
      setName(look.name);
      setOccasion(look.occasion || '');
      setEventDate(look.eventDate ? look.eventDate.split('T')[0] : '');
      setStylingNotes(look.stylingNotes || '');
      loadLookItems();
    }
  }, [look, open]);

  const loadLookItems = async () => {
    if (!look) return;
    setLoadingItems(true);
    try {
      // Use client's own closet so look itemIds (from client's request) resolve; fallback to stylist closet
      let closet = await getClientCloset(look.clientId);
      if (!closet) closet = await getOrCreateCloset(look.clientId);
      const items = await getClosetItems(closet.id);
      setClosetItems(items.filter((item) => !item.archived));

      const loadedLookItems = await getLookItemsByLookId(look.id);
      setLookItemRecords(loadedLookItems);

      const closetMap = new Map(items.map((c) => [c.id, c]));
      const composer: LookComposerItem[] = loadedLookItems
        .map((li) => {
          const closetItem = closetMap.get(li.itemId);
          if (!closetItem) return null;
          return {
            closetItem,
            positionX: li.positionX ?? 10,
            positionY: li.positionY ?? 10,
          };
        })
        .filter((c): c is LookComposerItem => c !== null);
      setComposerItems(composer);
    } catch (error) {
      console.error('Error loading look items:', error);
      showError('Failed to load items');
    } finally {
      setLoadingItems(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!look) return;
    if (!name.trim()) {
      showError('Look name is required');
      return;
    }
    if (composerItems.length === 0) {
      showError('Add at least one item to the look');
      return;
    }

    setLoading(true);
    try {
      await updateLook(look.id, {
        name: name.trim(),
        occasion: occasion.trim() || undefined,
        eventDate: eventDate || undefined,
        stylingNotes: stylingNotes.trim() || undefined,
      });

      const currentItemIds = new Set(lookItemRecords.map((li) => li.itemId));
      const newItemIds = new Set(composerItems.map((ci) => ci.closetItem.id));
      const toRemove = [...currentItemIds].filter((id) => !newItemIds.has(id));
      const toAdd = [...newItemIds].filter((id) => !currentItemIds.has(id));

      for (const itemId of toRemove) {
        const li = lookItemRecords.find((l) => l.itemId === itemId);
        if (li) await removeItemFromLook(li.id);
      }

      if (toAdd.length > 0) {
        const positions = toAdd.map((id) => {
          const ci = composerItems.find((c) => c.closetItem.id === id);
          return ci ? { positionX: ci.positionX, positionY: ci.positionY } : undefined;
        });
        await bulkAddItemsToLook(look.id, toAdd, 'closet_item', positions);
      }

      for (const ci of composerItems) {
        const li = lookItemRecords.find((l) => l.itemId === ci.closetItem.id);
        if (li && (li.positionX !== ci.positionX || li.positionY !== ci.positionY)) {
          await updateLookItem(li.id, {
            positionX: ci.positionX,
            positionY: ci.positionY,
          });
        }
      }

      try {
        const compositeDataUrl = await generateLookCompositeImage(composerItems, 600, 800, 180);
        await updateLook(look.id, { compositeImageUrl: compositeDataUrl });
      } catch (err) {
        console.warn('Could not regenerate composite image:', err);
      }

      setLoading(false);
      showSuccess('Look updated successfully');
      try {
        await Promise.resolve(onLookUpdated());
      } catch (refreshErr) {
        console.warn('Refresh after update failed:', refreshErr);
      }
      onOpenChange(false);
    } catch (error: any) {
      showError(error?.message || 'Failed to update look');
    } finally {
      setLoading(false);
    }
  };

  if (!look) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[95vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Edit Look</DialogTitle>
          <DialogDescription>
            Drag items from the closet into the look area. Drag items on the look to reposition.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-2 -mr-2">
          <div className="space-y-2">
            <Label htmlFor="editLookName">Look Name *</Label>
            <Input
              id="editLookName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Casual Weekend Outfit"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="editOccasion">Occasion</Label>
              <Input
                id="editOccasion"
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
                placeholder="e.g., Casual, Formal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editEventDate">Event Date</Label>
              <Input
                id="editEventDate"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2 flex-1 min-h-0">
            <Label>Compose Look *</Label>
            {loadingItems ? (
              <div className="flex items-center justify-center h-64 border rounded-md">
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : closetItems.length === 0 ? (
              <div className="flex items-center justify-center h-64 border rounded-md">
                <p className="text-sm text-muted-foreground">Closet is empty.</p>
              </div>
            ) : (
              <LookComposer
                closetItems={closetItems}
                lookItems={composerItems}
                onLookItemsChange={setComposerItems}
                canvasHeight={320}
                itemSize={composerItemSize}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="editStylingNotes">Styling Notes</Label>
            <Textarea
              id="editStylingNotes"
              value={stylingNotes}
              onChange={(e) => setStylingNotes(e.target.value)}
              placeholder="Add any styling notes..."
              rows={3}
            />
          </div>
          </div>

          <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || composerItems.length === 0}>
              {loading ? 'Updating...' : 'Update Look'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditLookDialog;
