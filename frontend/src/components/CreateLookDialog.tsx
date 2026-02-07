import { useState, useEffect, useRef, useMemo } from 'react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, Check, ChevronsUpDown, Square, Columns2, X, CalendarIcon, Eye } from 'lucide-react';
import { format, parse } from 'date-fns';
import { EventDatePickerModal } from '@/components/EventDatePickerModal';
import {
  createLook,
  bulkAddItemsToLook,
  updateLook,
  getLookItemsByLookId,
  removeItemFromLook,
  updateLookItem,
} from '@/utils/lookStorage';
import LookComposer, { LookComposerItem, generateLookCompositeImage } from '@/components/LookComposer';
import { getStylistClients } from '@/utils/clientStorage';
import { getClosetsByOwner, getClosetItems, getClientCloset, getOrCreateCloset } from '@/utils/closetStorage';
import { showSuccess, showError } from '@/utils/toast';
import { Client, ClosetItem, Look, LookItem, ItemCategory } from '@/types';
import { cn } from '@/lib/utils';
import { toFullSizeImageUrl } from '@/utils/fileUpload';

const STEPS = [1, 2, 3] as const;
type Step = (typeof STEPS)[number];

const CATEGORY_OPTIONS: { value: ItemCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'tops', label: 'Tops' },
  { value: 'bottoms', label: 'Bottoms' },
  { value: 'dresses', label: 'Dresses' },
  { value: 'outerwear', label: 'Outerwear' },
  { value: 'shoes', label: 'Shoes' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'bags', label: 'Bags' },
  { value: 'others', label: 'Others' },
];

interface CreateLookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLookCreated: (look: Look) => void | Promise<void>;
  preselectedClientId?: string;
  preselectedName?: string;
  preselectedItems?: ClosetItem[];
  /** When set, dialog runs in edit mode: title "Edit Look", starts at step 1, pre-fills from look, submit updates. */
  editLook?: Look | null;
  /** Called after look is updated in edit mode. */
  onLookUpdated?: () => void | Promise<void>;
}

const CreateLookDialog = ({
  open,
  onOpenChange,
  onLookCreated,
  preselectedClientId,
  preselectedName,
  preselectedItems,
  editLook,
  onLookUpdated,
}: CreateLookDialogProps) => {
  const isEditMode = !!editLook;
  const [step, setStep] = useState<Step>(1);
  const [clients, setClients] = useState<Client[]>([]);
  const [closets, setClosets] = useState<{ id: string; name: string }[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>(preselectedClientId || '');
  const [selectedClosetId, setSelectedClosetId] = useState<string>('');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [closetPopoverOpen, setClosetPopoverOpen] = useState(false);
  const [eventDatePickerOpen, setEventDatePickerOpen] = useState(false);
  const [name, setName] = useState('');
  const [occasion, setOccasion] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [stylingNotes, setStylingNotes] = useState('');
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<ClosetItem[]>([]);
  const [lookItems, setLookItems] = useState<LookComposerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingClosets, setLoadingClosets] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ItemCategory | 'all'>('all');
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const [itemsPerPagePopoverOpen, setItemsPerPagePopoverOpen] = useState(false);
  const [columns, setColumns] = useState<1 | 2>(2);
  const [itemsPerPage, setItemsPerPage] = useState<10 | 20 | 50>(20);
  const [itemPage, setItemPage] = useState(1);
  const [previewItem, setPreviewItem] = useState<ClosetItem | null>(null);
  const [stripHasOverflow, setStripHasOverflow] = useState(false);
  /** In edit mode, IDs of look item records for diffing (add/remove/update). */
  const [editLookItemRecords, setEditLookItemRecords] = useState<LookItem[]>([]);
  const appliedPreselectedRef = useRef(false);
  const selectedStripRef = useRef<HTMLDivElement>(null);
  /** When true, dialog is closing after a successful create – keep selected items for next time. */
  const keepSelectionsAfterCreateRef = useRef(false);
  const isMobile = useIsMobile();
  const composerItemSize = isMobile ? 140 : 110;

  useEffect(() => {
    const loadClients = async () => {
      try {
        const loadedClients = await getStylistClients();
        const sortedClients = [...loadedClients].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        );
        setClients(sortedClients);
        if (preselectedClientId) setSelectedClientId(preselectedClientId);
      } catch (error) {
        console.error('Error loading clients:', error);
      }
    };
    loadClients();
  }, [preselectedClientId]);

  useEffect(() => {
    if (!selectedClientId || !open) {
      setClosets([]);
      setSelectedClosetId('');
      return;
    }
    setLoadingClosets(true);
    getClosetsByOwner(selectedClientId)
      .then((list) => {
        setClosets(list.map((c) => ({ id: c.id, name: c.name })));
        if (list.length > 0 && !selectedClosetId) setSelectedClosetId(list[0].id);
      })
      .catch(() => setClosets([]))
      .finally(() => setLoadingClosets(false));
  }, [selectedClientId, open]);

  useEffect(() => {
    if (!selectedClosetId || !open) {
      setClosetItems([]);
      return;
    }
    setLoadingItems(true);
    getClosetItems(selectedClosetId)
      .then((items) => setClosetItems(items.filter((i) => !i.archived)))
      .catch(() => setClosetItems([]))
      .finally(() => setLoadingItems(false));
  }, [selectedClosetId, open]);

  useEffect(() => {
    if (!open) {
      appliedPreselectedRef.current = false;
      return;
    }
    const hasPreselected =
      (preselectedName != null && preselectedName !== '') ||
      (preselectedItems != null && preselectedItems.length > 0);
    if (open && hasPreselected && !appliedPreselectedRef.current && !editLook) {
      if (preselectedName != null && preselectedName !== '') setName(preselectedName);
      if (preselectedItems != null && preselectedItems.length > 0) {
        setSelectedItems(preselectedItems);
      }
      appliedPreselectedRef.current = true;
    }
  }, [open, preselectedName, preselectedItems, editLook]);

  // Edit mode: pre-fill step 1 and load look items when dialog opens
  useEffect(() => {
    if (!open || !editLook) return;
    setStep(1);
    setName(editLook.name);
    setOccasion(editLook.occasion || '');
    setEventDate(editLook.eventDate ? editLook.eventDate.split('T')[0] : '');
    setStylingNotes(editLook.stylingNotes || '');
    setSelectedClientId(editLook.clientId);
    setSelectedClosetId('');
    setSelectedItems([]);
    setLookItems([]);

    let cancelled = false;
    (async () => {
      try {
        let closet = await getClientCloset(editLook!.clientId);
        if (!closet) {
          try {
            closet = await getOrCreateCloset(editLook!.clientId);
          } catch {
            const list = await getClosetsByOwner(editLook!.clientId);
            closet = list.length > 0 ? list[0] : null;
          }
        }
        if (cancelled) return;
        if (!closet) {
          showError('No closet found for this client');
          return;
        }
        setSelectedClosetId(closet.id);

        const [items, lookItemRecords] = await Promise.all([
          getClosetItems(closet.id),
          getLookItemsByLookId(editLook!.id),
        ]);
        if (cancelled) return;
        const filteredItems = items.filter((i) => !i.archived);
        const closetMap = new Map(filteredItems.map((c) => [c.id, c]));
        const composer: LookComposerItem[] = lookItemRecords
          .map((li) => {
            const closetItem = closetMap.get(li.itemId);
            if (!closetItem) return null;
            return {
              closetItem,
              positionX: li.positionX ?? 10,
              positionY: li.positionY ?? 10,
              scale: li.scale ?? 1,
            };
          })
          .filter((c): c is LookComposerItem => c !== null);
        setSelectedItems(composer.map((ci) => ci.closetItem));
        setLookItems(composer);
        setEditLookItemRecords(lookItemRecords);
      } catch (err) {
        console.error('Error loading look for edit:', err);
        showError('Failed to load look');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, editLook?.id]);

  const filteredClients = useMemo(
    () =>
      clients.filter(
        (c) =>
          c.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
          c.email?.toLowerCase().includes(clientSearchQuery.toLowerCase())
      ),
    [clients, clientSearchQuery]
  );

  const filteredClosetItems = useMemo(() => {
    let list = closetItems;
    const q = itemSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.name?.toLowerCase().includes(q) ||
          i.category?.toLowerCase().includes(q) ||
          i.brand?.toLowerCase().includes(q) ||
          i.notes?.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== 'all') {
      list = list.filter((i) => i.category === categoryFilter);
    }
    return list;
  }, [closetItems, itemSearchQuery, categoryFilter]);

  const totalItemPages = Math.max(1, Math.ceil(filteredClosetItems.length / itemsPerPage));
  const safeItemPage = Math.min(itemPage, totalItemPages);
  const paginatedClosetItems = useMemo(
    () =>
      filteredClosetItems.slice(
        (safeItemPage - 1) * itemsPerPage,
        safeItemPage * itemsPerPage
      ),
    [filteredClosetItems, safeItemPage, itemsPerPage]
  );

  useEffect(() => {
    setItemPage(1);
  }, [itemSearchQuery, categoryFilter, itemsPerPage]);

  // Detect if selected items strip has horizontal overflow (needs scrolling)
  useEffect(() => {
    const checkOverflow = () => {
      const el = selectedStripRef.current;
      if (el) {
        // Check if content is wider than visible area
        setStripHasOverflow(el.scrollWidth > el.clientWidth);
      } else {
        setStripHasOverflow(false);
      }
    };

    // Use requestAnimationFrame to ensure DOM has been updated
    const rafId = requestAnimationFrame(checkOverflow);

    // Also check on window resize
    window.addEventListener('resize', checkOverflow);

    // Use ResizeObserver for more reliable detection when container size changes
    let resizeObserver: ResizeObserver | null = null;
    if (selectedStripRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(checkOverflow);
      resizeObserver.observe(selectedStripRef.current);
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', checkOverflow);
      resizeObserver?.disconnect();
    };
  }, [selectedItems, step]);

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const step1Valid =
    name.trim() !== '' &&
    selectedClientId !== '' &&
    selectedClosetId !== '' &&
    closets.some((c) => c.id === selectedClosetId);
  const step2Valid = selectedItems.length >= 1;

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    setSelectedClosetId('');
    setClosets([]);
    setClientPopoverOpen(false);
    setClientSearchQuery('');
    setSelectedItems([]);
  };

  const toggleItemSelection = (item: ClosetItem) => {
    setSelectedItems((prev) => {
      const exists = prev.some((i) => i.id === item.id);
      if (exists) return prev.filter((i) => i.id !== item.id);
      return [...prev, item];
    });
  };

  const addItemFromPreview = (item: ClosetItem) => {
    setSelectedItems((prev) => {
      if (prev.some((i) => i.id === item.id)) return prev;
      return [...prev, item];
    });
    setPreviewItem(null);
  };

  const removeFromStrip = (itemId: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const goNext = () => {
    if (step === 1 && step1Valid) {
      setStep(2);
      return;
    }
    if (step === 2 && step2Valid) {
      // Initialize items with grid positions optimized for percentage-based canvas
      // Items are ~28% wide on mobile, ~22% on desktop, so space them accordingly
      const cols = isMobile ? 2 : 3;
      const baseScale = 1; // Start at default scale
      const xSpacing = isMobile ? 36 : 33; // % spacing between items
      const ySpacing = isMobile ? 36 : 33;
      const xOffset = isMobile ? 3 : 5; // % offset from left
      const yOffset = isMobile ? 3 : 5; // % offset from top

      setLookItems((prev) =>
        selectedItems.map((item, i) => {
          const existing = isEditMode ? prev.find((li) => li.closetItem.id === item.id) : null;
          if (existing) {
            // Preserve existing positions for edit mode
            return { ...existing, closetItem: item };
          }
          return {
            closetItem: item,
            positionX: (i % cols) * xSpacing + xOffset,
            positionY: Math.floor(i / cols) * ySpacing + yOffset,
            scale: baseScale,
          };
        })
      );
      setStep(3);
    }
  };

  const goBack = () => {
    if (step === 2) setStep(1);
    if (step === 3) {
      // Sync selectedItems with lookItems when going back to Step 2
      // This ensures items removed in Step 3 are also removed from selection
      setSelectedItems(lookItems.map(li => li.closetItem));
      setStep(2);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only allow submission on step 3
    if (step !== 3) return;
    
    // Prevent double submission
    if (loading) return;
    
    // Validate required fields
    if (!name.trim()) {
      showError('Look name is required');
      return;
    }
    if (!selectedClientId) {
      showError('Please select a client');
      return;
    }
    if (!selectedClosetId) {
      showError('Please select a closet');
      return;
    }
    if (lookItems.length === 0) {
      showError('Add at least one item to the look');
      return;
    }

    setLoading(true);

    const loadingTimeout = setTimeout(() => {
      setLoading(false);
      showError('Request timed out. Please try again.');
    }, 30000);

    try {
      if (isEditMode && editLook) {
        // 1. Update look metadata (fast)
        await updateLook(editLook.id, {
          name: name.trim(),
          occasion: occasion.trim() || undefined,
          eventDate: eventDate || undefined,
          stylingNotes: stylingNotes.trim() || undefined,
        });

        const currentItemIds = new Set(editLookItemRecords.map((li) => li.itemId));
        const newItemIds = new Set(lookItems.map((li) => li.closetItem.id));
        const toRemove = editLookItemRecords.filter((li) => !newItemIds.has(li.itemId));
        const toAdd = lookItems.filter((ci) => !currentItemIds.has(ci.closetItem.id));

        // 2. Remove items in parallel (no sequential await)
        await Promise.all(toRemove.map((li) => removeItemFromLook(li.id)));

        // 3. Bulk add new items
        if (toAdd.length > 0) {
          const positions = toAdd.map((ci) => ({
            positionX: ci.positionX,
            positionY: ci.positionY,
            scale: ci.scale ?? 1,
          }));
          await bulkAddItemsToLook(editLook.id, toAdd.map((ci) => ci.closetItem.id), 'closet_item', positions);
        }

        // 4. Update positions in parallel (no sequential await)
        const positionUpdates = lookItems
          .map((ci) => {
            const li = editLookItemRecords.find((l) => l.itemId === ci.closetItem.id);
            if (!li || (li.positionX === ci.positionX && li.positionY === ci.positionY && (li.scale ?? 1) === (ci.scale ?? 1)))
              return null;
            return updateLookItem(li.id, {
              positionX: ci.positionX,
              positionY: ci.positionY,
              scale: ci.scale ?? 1,
            });
          })
          .filter(Boolean) as Promise<unknown>[];
        await Promise.all(positionUpdates);

        clearTimeout(loadingTimeout);
        setLoading(false);
        showSuccess('Look updated successfully');
        handleReset();
        onOpenChange(false);
        onLookUpdated?.();

        // 5. Composite image in background – defer so UI can update first
        const lookId = editLook.id;
        const itemsForComposite = [...lookItems];
        setTimeout(() => {
          generateLookCompositeImage(itemsForComposite, 600, 800, 180)
            .then((compositeDataUrl) => updateLook(lookId, { compositeImageUrl: compositeDataUrl }))
            .then(() => onLookUpdated?.())
            .catch((err) => console.warn('Could not regenerate composite image:', err));
        }, 0);
      } else {
        // Create new look
        const newLook = await createLook({
          clientId: selectedClientId,
          name: name.trim(),
          occasion: occasion.trim() || undefined,
          eventDate: eventDate || undefined,
          stylingNotes: stylingNotes.trim() || undefined,
          status: 'draft',
        });

        const itemIds = lookItems.map((li) => li.closetItem.id);
        const positions = lookItems.map((li) => ({
          positionX: li.positionX,
          positionY: li.positionY,
          scale: li.scale ?? 1,
        }));
        await bulkAddItemsToLook(newLook.id, itemIds, 'closet_item', positions);

        clearTimeout(loadingTimeout);
        setLoading(false);
        showSuccess('Look created successfully! 🎉');
        keepSelectionsAfterCreateRef.current = true;
        setStep(1);
        onOpenChange(false);
        Promise.resolve(onLookCreated(newLook)).catch((err) => {
          console.error('onLookCreated callback failed:', err);
        });
        setTimeout(() => {
          generateLookCompositeImage(lookItems, 600, 800, 180)
            .then((compositeDataUrl) => updateLook(newLook.id, { compositeImageUrl: compositeDataUrl }))
            .catch((err) => console.warn('Could not generate composite image:', err));
        }, 0);
      }
    } catch (error: unknown) {
      clearTimeout(loadingTimeout);
      console.error(isEditMode ? 'Failed to update look:' : 'Failed to create look:', error);
      showError(error instanceof Error ? error.message : (isEditMode ? 'Failed to update look.' : 'Failed to create look.') + ' Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setName('');
    setOccasion('');
    setEventDate('');
    setStylingNotes('');
    setSelectedItems([]);
    setLookItems([]);
    setEditLookItemRecords([]);
    setItemSearchQuery('');
    setCategoryFilter('all');
    setPreviewItem(null);
    setClientSearchQuery('');
    if (!preselectedClientId && !editLook) setSelectedClientId('');
    setSelectedClosetId('');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          if (keepSelectionsAfterCreateRef.current) {
            keepSelectionsAfterCreateRef.current = false;
          } else {
            handleReset();
          }
        }
        onOpenChange(o);
      }}
    >
      <DialogContent
        className={cn(
          'w-[calc(100vw-2rem)] max-w-[min(900px,calc(100vw-2rem))] max-h-[95vh] flex flex-col rounded-lg overflow-x-hidden box-border',
          step === 2 ? 'px-1 sm:px-2' : 'px-4 sm:px-6'
        )}
      >
        <DialogHeader className="flex-shrink-0 pr-8 pb-1">
          <DialogTitle className="text-lg">{isEditMode ? 'Edit Look' : 'Create Look'}</DialogTitle>
          <DialogDescription className="text-sm mt-0.5">
            {step === 1 && (isEditMode ? 'Update look details and client or closet if needed.' : 'Enter look details and select the client and closet.')}
            {step === 2 && (isEditMode ? 'Search and select items from the closet to include in the look.' : 'Search and select items from the closet to include in the look.')}
            {step === 3 && (isEditMode ? 'Arrange items and add notes. Click "Update Look" when ready.' : 'Arrange items and add notes. Click "Create Look" when ready.')}
          </DialogDescription>
          <div className="flex gap-1 pt-1">
            {STEPS.map((s) => (
              <div
                key={s}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  step >= s ? 'bg-primary' : 'bg-muted'
                )}
              />
            ))}
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
          <div
            className={cn(
              'flex-1 min-h-0 min-w-0 overflow-x-hidden',
              step === 2 ? 'overflow-y-hidden px-0 flex flex-col' : 'overflow-y-auto px-3 sm:px-4 py-2'
            )}
            style={step === 2 ? { display: 'flex', flexDirection: 'column' } : undefined}
          >
            {/* Step 1 – Basic details: all fields visible from the start */}
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="space-y-2">
                  <Label htmlFor="lookName">Look Name *</Label>
                  <Input
                    id="lookName"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Casual Weekend Outfit"
                    className="create-look-input w-full min-w-0 max-w-full box-border"
                  />
                </div>

                {!preselectedClientId && (
                  <div className="space-y-2">
                    <Label>Client *</Label>
                    <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between create-look-input box-border max-w-full">
                          {selectedClientId
                            ? clients.find((c) => c.id === selectedClientId)?.name
                            : 'Select a client...'}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[var(--radix-popover-trigger-width)] min-w-0 max-w-[calc(100vw-2rem)] p-0"
                        align="start"
                        sideOffset={8}
                      >
                        <div className="flex items-center border-b px-3 py-2">
                          <Search className="mr-2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search clients..."
                            value={clientSearchQuery}
                            onChange={(e) => setClientSearchQuery(e.target.value)}
                            className="h-9 border-0 bg-transparent focus-visible:ring-0"
                          />
                        </div>
                        <div className="max-h-[12rem] overflow-y-auto py-1">
                          {filteredClients.length === 0 ? (
                            <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                              No clients found
                            </p>
                          ) : (
                            <ul className="list-none p-0 m-0">
                              {filteredClients.map((client) => (
                                <li
                                  key={client.id}
                                  className={cn(
                                    'flex items-center gap-2 rounded-md px-3 py-2.5 text-sm cursor-pointer',
                                    selectedClientId === client.id ? 'bg-accent font-medium' : 'hover:bg-accent/50'
                                  )}
                                  onClick={() => handleClientChange(client.id)}
                                >
                                  <Check
                                    className={cn('h-4 w-4 shrink-0', selectedClientId === client.id ? 'opacity-100' : 'opacity-0')}
                                  />
                                  <span className="truncate">{client.name}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="closet">Closet *</Label>
                  <Popover open={closetPopoverOpen} onOpenChange={setClosetPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="closet"
                        variant="outline"
                        disabled={!selectedClientId || loadingClosets}
                        className="w-full justify-between create-look-input box-border max-w-full"
                      >
                        {!selectedClientId
                          ? 'Select a client first'
                          : loadingClosets
                            ? 'Loading...'
                            : selectedClosetId
                              ? closets.find((c) => c.id === selectedClosetId)?.name ?? 'Select a closet...'
                              : 'Select a closet...'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[var(--radix-popover-trigger-width)] min-w-0 max-w-[calc(100vw-2rem)] p-0 touch-pan-y"
                      align="start"
                      sideOffset={8}
                    >
                      <div
                        role="region"
                        aria-label="Closet list"
                        className="max-h-[8rem] overflow-y-auto overflow-x-hidden overscroll-contain py-1 touch-pan-y [-webkit-overflow-scrolling:touch]"
                        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                      >
                        {closets.length === 0 ? (
                          <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                            {loadingClosets ? 'Loading closets...' : 'No closets found'}
                          </p>
                        ) : (
                          <ul className="list-none p-0 m-0" role="listbox">
                            {closets.map((closet) => (
                              <li
                                key={closet.id}
                                role="option"
                                aria-selected={selectedClosetId === closet.id}
                                className={cn(
                                  'flex items-center gap-2 rounded-md px-3 py-2.5 text-sm cursor-pointer transition-colors',
                                  selectedClosetId === closet.id ? 'bg-accent font-medium' : 'hover:bg-accent/50'
                                )}
                                onClick={() => {
                                  setSelectedClosetId(closet.id);
                                  setClosetPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    'h-4 w-4 shrink-0',
                                    selectedClosetId === closet.id ? 'opacity-100' : 'opacity-0'
                                  )}
                                />
                                <span className="truncate">{closet.name}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                  {loadingClosets && selectedClientId && (
                    <p className="text-xs text-muted-foreground">Loading closets...</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 min-w-0">
                    <Label htmlFor="occasion">Occasion</Label>
                    <Input
                      id="occasion"
                      value={occasion}
                      onChange={(e) => setOccasion(e.target.value)}
                      placeholder="e.g., Casual, Formal"
                      className="create-look-input w-full min-w-0 max-w-full box-border px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-2 min-w-0">
                    <Label htmlFor="eventDate">Event Date</Label>
                    <Button
                      type="button"
                      id="eventDate"
                      variant="outline"
                      onClick={() => setEventDatePickerOpen(true)}
                      className={cn(
                        'w-full justify-start text-left font-normal h-10 create-look-input box-border max-w-full',
                        !eventDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                      {eventDate
                        ? (() => {
                            try {
                              const d = parse(eventDate, 'yyyy-MM-dd', new Date());
                              return format(d, 'MMM d, yyyy');
                            } catch {
                              return eventDate;
                            }
                          })()
                        : 'Pick a date'}
                    </Button>
                    <EventDatePickerModal
                      open={eventDatePickerOpen}
                      onOpenChange={setEventDatePickerOpen}
                      value={eventDate}
                      onSelect={(date) => setEventDate(date)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2 – Item selection (full-width, grid scrolls with touch) */}
            {step === 2 && (
              <div className="flex flex-col min-h-0 min-w-0 flex-1 animate-in fade-in duration-200 h-full">
                {loadingItems ? (
                  <div className="flex items-center justify-center py-12 px-3">
                    <p className="text-sm text-muted-foreground">Loading closet items...</p>
                  </div>
                ) : (
                  <>
                    {/* Toolbar: single row with all controls */}
                    <div className="flex flex-row items-center gap-1.5 flex-shrink-0 px-2 sm:px-3 py-2 flex-nowrap">
                      {/* Search input - takes available space */}
                      <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          placeholder="Search..."
                          value={itemSearchQuery}
                          onChange={(e) => setItemSearchQuery(e.target.value)}
                          className="pl-8 h-8 w-full min-w-0 text-sm"
                        />
                      </div>
                      
                      {/* Category filter */}
                      <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 min-w-0 shrink-0 px-2 text-xs"
                            aria-expanded={categoryPopoverOpen}
                            aria-label="Category filter"
                          >
                            <span className="truncate max-w-[70px] sm:max-w-[90px]">
                              {CATEGORY_OPTIONS.find((o) => o.value === categoryFilter)?.label ?? 'All'}
                            </span>
                            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="z-[110] min-w-[10rem] max-w-[min(100vw-2rem,14rem)] p-0 rounded-lg border shadow-lg max-h-[min(60vh,280px)] overflow-y-auto overflow-x-hidden"
                          align="start"
                          sideOffset={6}
                          collisionPadding={12}
                          avoidCollisions
                        >
                          <ul className="py-1.5 px-1" role="listbox" aria-label="Category list">
                            {CATEGORY_OPTIONS.map((opt) => (
                              <li key={opt.value} role="option" aria-selected={categoryFilter === opt.value}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCategoryFilter(opt.value);
                                    setCategoryPopoverOpen(false);
                                  }}
                                  className={cn(
                                    'w-full min-h-[44px] px-3 py-2.5 text-left text-sm touch-manipulation transition-colors rounded-md whitespace-nowrap',
                                    categoryFilter === opt.value ? 'bg-accent font-medium' : 'hover:bg-accent/50'
                                  )}
                                >
                                  {opt.label}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </PopoverContent>
                      </Popover>
                      
                      {/* View toggle: 1 or 2 images per row */}
                      <div className="flex items-center gap-0.5 border rounded-md p-0.5 shrink-0 bg-muted/30">
                        <button
                          type="button"
                          onClick={() => setColumns(1)}
                          className={cn(
                            'p-1.5 rounded min-w-[28px] min-h-[28px] flex items-center justify-center touch-manipulation transition-colors',
                            columns === 1 ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                          )}
                          aria-label="1 image per row"
                          title="1 per row"
                        >
                          <Square className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setColumns(2)}
                          className={cn(
                            'p-1.5 rounded min-w-[28px] min-h-[28px] flex items-center justify-center touch-manipulation transition-colors',
                            columns === 2 ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                          )}
                          aria-label="2 images per row"
                          title="2 per row"
                        >
                          <Columns2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      
                      {/* Items per page */}
                      <Popover open={itemsPerPagePopoverOpen} onOpenChange={setItemsPerPagePopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 min-w-[2.5rem] shrink-0 px-1.5 text-xs"
                            aria-expanded={itemsPerPagePopoverOpen}
                            aria-label="Items per page"
                            title="Items per page"
                          >
                            {itemsPerPage}
                            <ChevronsUpDown className="ml-0.5 h-3 w-3 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="z-[110] min-w-[var(--radix-popover-trigger-width)] max-w-[min(100vw-2rem,10rem)] p-0 rounded-lg border shadow-lg"
                          align="end"
                          sideOffset={6}
                          collisionPadding={12}
                          avoidCollisions
                        >
                          <ul className="py-1.5 px-1" role="listbox" aria-label="Items per page">
                            {([10, 20, 50] as const).map((n) => (
                              <li key={n} role="option" aria-selected={itemsPerPage === n}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setItemsPerPage(n);
                                    setItemsPerPagePopoverOpen(false);
                                  }}
                                  className={cn(
                                    'w-full min-h-[44px] px-3 py-2.5 text-left text-sm touch-manipulation transition-colors rounded-md',
                                    itemsPerPage === n ? 'bg-accent font-medium' : 'hover:bg-accent/50'
                                  )}
                                >
                                  {n} per page
                                </button>
                              </li>
                            ))}
                          </ul>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Scrollable items grid wrapper */}
                    <div 
                      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain"
                      style={{ 
                        minHeight: '200px',
                        WebkitOverflowScrolling: 'touch',
                        touchAction: 'pan-y',
                        overscrollBehaviorY: 'contain',
                      }}
                    >
                      <div
                        className={cn(
                          'grid gap-2 w-full px-2 sm:px-3 pt-1 pb-8',
                          columns === 1 && 'grid-cols-1',
                          columns === 2 && 'grid-cols-2'
                        )}
                      >
                        {filteredClosetItems.length === 0 ? (
                          <p className="col-span-full text-sm text-muted-foreground text-center py-8">
                            No items match. Try changing search or category.
                          </p>
                        ) : (
                          paginatedClosetItems.map((item) => {
                            const isSelected = selectedItems.some((i) => i.id === item.id);
                            return (
                              <div
                                key={item.id}
                                className={cn(
                                  'relative rounded-lg overflow-hidden bg-muted/30 transition-all border-[3px]',
                                  isSelected 
                                    ? 'border-black ring-2 ring-black/20' 
                                    : 'border-transparent hover:border-muted-foreground/20'
                                )}
                              >
                                {/* Tap on image to select/deselect */}
                                <button
                                  type="button"
                                  className="w-full aspect-square block p-0 border-0 bg-transparent cursor-pointer"
                                  onClick={() => toggleItemSelection(item)}
                                  aria-label={isSelected ? 'Deselect item' : 'Select item'}
                                >
                                  <img
                                    src={toFullSizeImageUrl(item.photoUrl)}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                                {/* Eye icon to open preview modal */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewItem(item);
                                  }}
                                  className="absolute bottom-2 right-2 rounded-full p-1.5 shadow-lg bg-black/60 text-white hover:bg-black/80 active:bg-black min-w-[32px] min-h-[32px] flex items-center justify-center touch-manipulation transition-colors"
                                  aria-label="Preview item"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                {/* Selected indicator badge */}
                                {isSelected && (
                                  <div className="absolute top-2 left-2 bg-black text-white rounded-full p-1 shadow-lg">
                                    <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                                      <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Pagination */}
                    {totalItemPages > 1 && filteredClosetItems.length > 0 && (
                      <div className="flex items-center justify-center gap-3 py-2 flex-shrink-0 px-3 sm:px-4">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setItemPage((p) => Math.max(1, p - 1))}
                          disabled={safeItemPage <= 1}
                          className="touch-manipulation"
                        >
                          Previous
                        </Button>
                        <span className="text-sm text-muted-foreground tabular-nums">
                          Page {safeItemPage} of {totalItemPages}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setItemPage((p) => Math.min(totalItemPages, p + 1))}
                          disabled={safeItemPage >= totalItemPages}
                          className="touch-manipulation"
                        >
                          Next
                        </Button>
                      </div>
                    )}

                    {/* Fixed bottom selected items strip - always visible */}
                    <div className="flex-shrink-0 border-t bg-background min-w-0 px-2 sm:px-3 py-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-medium text-muted-foreground">
                          Selected ({selectedItems.length})
                        </p>
                        {stripHasOverflow && (
                          <p className="text-xs text-muted-foreground">Swipe to see all →</p>
                        )}
                      </div>
                      <div
                        ref={selectedStripRef}
                        className="w-full min-w-0 overflow-x-auto overflow-y-hidden rounded-md border bg-muted/20 touch-pan-x"
                        style={{
                          WebkitOverflowScrolling: 'touch',
                          touchAction: 'pan-x',
                          overscrollBehaviorX: 'contain',
                          scrollSnapType: 'x proximity',
                        }}
                        role="region"
                        aria-label="Selected items strip"
                      >
                        <div className="flex gap-2 p-2 min-h-[4.5rem] items-center" style={{ width: 'max-content' }}>
                          {selectedItems.length === 0 ? (
                            <p className="text-xs text-muted-foreground px-2 whitespace-nowrap">
                              Tap items above to select
                            </p>
                          ) : (
                            selectedItems.map((item) => (
                              <div
                                key={item.id}
                                className="relative flex-shrink-0 w-14 h-14 rounded-md overflow-hidden border-2 border-black bg-muted group"
                                style={{ scrollSnapAlign: 'start' }}
                              >
                                <img
                                  src={toFullSizeImageUrl(item.photoUrl)}
                                  alt={item.name}
                                  className="w-full h-full object-cover pointer-events-none select-none"
                                  draggable={false}
                                />
                                <button
                                  type="button"
                                  onClick={() => removeFromStrip(item.id)}
                                  className="absolute top-0.5 right-0.5 rounded-full p-1 bg-black/70 text-white hover:bg-black/90 active:bg-black touch-manipulation min-w-[22px] min-h-[22px] flex items-center justify-center z-10"
                                  aria-label="Remove from selection"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {previewItem && (
                  <Dialog open={!!previewItem} onOpenChange={(o) => !o && setPreviewItem(null)}>
                    <DialogContent className="z-[110] max-w-[min(100vw-2rem,24rem)] p-0 gap-0 overflow-hidden rounded-xl border bg-background shadow-xl">
                      <div className="flex flex-col">
                        {/* Close button */}
                        <button
                          type="button"
                          onClick={() => setPreviewItem(null)}
                          className="absolute top-3 right-3 z-10 rounded-full p-1.5 bg-black/50 text-white hover:bg-black/70 touch-manipulation"
                          aria-label="Close preview"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        
                        {/* Image preview */}
                        <div className="relative flex-1 flex flex-col items-center p-4 pb-3">
                          <div className={cn(
                            'w-full aspect-square rounded-lg overflow-hidden border-[3px]',
                            selectedItems.some((i) => i.id === previewItem.id) 
                              ? 'border-black' 
                              : 'border-transparent'
                          )}>
                            <img
                              src={toFullSizeImageUrl(previewItem.photoUrl)}
                              alt={previewItem.name}
                              className="w-full h-full object-contain bg-muted/30"
                            />
                          </div>
                          <p className="mt-3 text-sm font-medium text-center text-foreground line-clamp-2 px-2">
                            {previewItem.name}
                          </p>
                          {previewItem.category && (
                            <p className="mt-1 text-xs text-muted-foreground capitalize">
                              {previewItem.category}
                            </p>
                          )}
                        </div>
                        
                        {/* Action buttons */}
                        <div className="p-4 pt-2 bg-muted/20 space-y-2">
                          {selectedItems.some((i) => i.id === previewItem.id) ? (
                            <button
                              type="button"
                              onClick={() => {
                                removeFromStrip(previewItem.id);
                                setPreviewItem(null);
                              }}
                              className="w-full min-h-[48px] rounded-lg border-2 border-red-500 bg-red-50 text-red-600 font-medium text-base hover:bg-red-100 active:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 touch-manipulation"
                              aria-label="Remove from Look"
                            >
                              Remove from Look
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => addItemFromPreview(previewItem)}
                              className="w-full min-h-[48px] rounded-lg border-0 bg-black text-white font-medium text-base shadow-md hover:bg-black/90 active:bg-black/80 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 touch-manipulation"
                              aria-label="Add Item to Look"
                            >
                              Add Item to Look
                            </button>
                          )}
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            )}

            {/* Step 3 – Canvas + Notes */}
            {step === 3 && (
              <div className="flex flex-col gap-3 animate-in fade-in duration-200 min-h-0">
                {/* Info Banner - Mobile specific */}
                {isMobile && (
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 flex-shrink-0">
                    <p className="text-sm text-blue-700 dark:text-blue-300 text-center">
                      <strong>Tap</strong> an item to show controls • <strong>Drag</strong> to move
                    </p>
                  </div>
                )}
                {/* Info Banner - Desktop */}
                {!isMobile && (
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 flex-shrink-0">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Drag items to reposition. Drag the corner handle to resize. Click X to remove.
                    </p>
                  </div>
                )}

                {/* Canvas Section - Fixed height, no scroll */}
                <div className="flex-shrink-0 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-base font-medium">Arrange Your Look</Label>
                    <span className="text-xs text-muted-foreground">
                      {lookItems.length} item{lookItems.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {/* Canvas wrapper - fixed size with overflow visible for controls */}
                  <div 
                    className="rounded-xl"
                    style={{
                      // Fixed height canvas area - taller on mobile for better touch targets
                      height: isMobile ? 340 : 320,
                      maxHeight: isMobile ? 340 : 320,
                      overflow: 'visible',
                    }}
                  >
                    <LookComposer
                      closetItems={[]}
                      lookItems={lookItems}
                      onLookItemsChange={setLookItems}
                      canvasHeight={isMobile ? 340 : 320}
                      itemSize={composerItemSize}
                      canvasOnly
                    />
                  </div>
                </div>

                {/* Notes Section - Can scroll if needed */}
                <div className="flex-shrink-0 space-y-2 border-t pt-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="stylingNotes" className="text-base font-medium">
                      Styling Notes
                    </Label>
                    <span className="text-xs text-muted-foreground">(optional)</span>
                  </div>
                  <Textarea
                    id="stylingNotes"
                    value={stylingNotes}
                    onChange={(e) => setStylingNotes(e.target.value)}
                    placeholder="Add styling tips, care instructions, or any notes about this look..."
                    rows={isMobile ? 2 : 2}
                    className="w-full min-w-0 resize-none min-h-[50px] text-base md:text-sm leading-relaxed focus-visible:ring-2 focus-visible:ring-primary/50"
                    style={{ touchAction: 'pan-y' }}
                  />
                </div>

              </div>
            )}
          </div>

          <DialogFooter className={cn(
            "flex-shrink-0 border-t pt-2 mt-2 gap-2",
            step === 3 && "flex-col"
          )}>
            {/* Create / Update Look Button - In footer for Step 3 */}
            {step === 3 && (
              <div className="w-full pb-2">
                <Button 
                  type="submit" 
                  disabled={loading || lookItems.length === 0}
                  className="w-full h-12 text-base font-semibold bg-black hover:bg-black/90 text-white shadow-lg"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {isEditMode ? 'Updating...' : 'Creating Look...'}
                    </span>
                  ) : (
                    isEditMode ? 'Update Look' : 'Create Look'
                  )}
                </Button>
                {lookItems.length === 0 && (
                  <p className="text-xs text-destructive text-center mt-1">
                    Add at least one item to the look
                  </p>
                )}
              </div>
            )}
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={goBack} disabled={loading}>
                Back
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
            )}
            {step < 3 && (
              <Button
                type="button"
                onClick={goNext}
                disabled={
                  loading ||
                  (step === 1 && !step1Valid) ||
                  (step === 2 && (!step2Valid || loadingItems))
                }
              >
                Next
              </Button>
            )}
            {/* Step 3 has the Create Look button in the content area for better visibility */}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateLookDialog;
