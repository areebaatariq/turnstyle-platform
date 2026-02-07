import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import AddClosetItemDialog from '@/components/AddClosetItemDialog';
import BulkUploadDialog from '@/components/BulkUploadDialog';
import RequestLookDialog from '@/components/RequestLookDialog';
import ClosetItemCard from '@/components/ClosetItemCard';
import CreateLookDialog from '@/components/CreateLookDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Search, Plus, Upload, Shirt, Sparkles, ChevronRight, ChevronLeft } from 'lucide-react';
import { updateClosetItem, deleteClosetItem } from '@/utils/closetStorage';
import { getCurrentUser } from '@/utils/auth';
import { showSuccess, showError } from '@/utils/toast';
import { Client, ClosetItem, ItemCategory, Closet } from '@/types';
import { useClients, useClosetsBatch, useClosetItems, useClosetsByOwner, useCreateCloset, useMyClient, useRefresh } from '@/hooks/useQueries';
import { useDebounce } from '@/hooks/useDebounce';

// Component for displaying client closet card with item count from batch data
const ClientClosetCard = ({ client, itemCount, getInitials, onClosetClick }: { 
  client: Client;
  itemCount: number;
  getInitials: (name: string) => string;
  onClosetClick: () => void;
}) => {
  return (
    <Card
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClosetClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={client.profilePhotoUrl} />
              <AvatarFallback>{getInitials(client.name)}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-lg">{client.name}</h3>
              <p className="text-sm text-muted-foreground">
                {`${itemCount} item${itemCount !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
};

const CATEGORIES: { value: ItemCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All Items' },
  { value: 'tops', label: 'Tops' },
  { value: 'bottoms', label: 'Bottoms' },
  { value: 'dresses', label: 'Dresses' },
  { value: 'outerwear', label: 'Outerwear' },
  { value: 'shoes', label: 'Shoes' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'bags', label: 'Bags' },
  { value: 'others', label: 'Others' },
];

const CATEGORIES_LIST = CATEGORIES.filter((c): c is { value: ItemCategory; label: string } => c.value !== 'all');

const Closets = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const isStylist = currentUser?.userType === 'stylist';
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const debouncedClientSearch = useDebounce(clientSearchQuery, 300);
  const [mainTab, setMainTab] = useState<'items' | 'categories'>('items');
  const [selectedCategoryForView, setSelectedCategoryForView] = useState<ItemCategory | null>(null);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [bulkUploadDialogOpen, setBulkUploadDialogOpen] = useState(false);
  const [createLookDialogOpen, setCreateLookDialogOpen] = useState(false);
  const [requestLookDialogOpen, setRequestLookDialogOpen] = useState(false);
  const [addClosetDialogOpen, setAddClosetDialogOpen] = useState(false);
  const [newClosetName, setNewClosetName] = useState('');
  const [selectedItem, setSelectedItem] = useState<ClosetItem | null>(null);

  // URL state: clientId and closetId (stylist uses both; client uses closetId with client from myClient)
  const clientIdFromUrl = searchParams.get('clientId');
  const closetIdFromUrl = searchParams.get('closetId');
  const { data: myClient, isLoading: myClientLoading } = useMyClient();
  const selectedClientId = isStylist ? (clientIdFromUrl || '') : (myClient?.id || '');
  const selectedClosetId = closetIdFromUrl || '';

  // React Query hooks
  const { data: clients = [] } = useClients();
  const clientIds = useMemo(() => clients.map(c => c.id), [clients]);
  const { data: closetBatchData = [] } = useClosetsBatch(
    !selectedClientId && isStylist ? clientIds : []
  );
  const itemCountMap = useMemo(() => {
    const map = new Map<string, number>();
    closetBatchData.forEach((item: { clientId: string; totalItemCount?: number; itemCount?: number }) => {
      map.set(item.clientId, item.totalItemCount ?? item.itemCount ?? 0);
    });
    return map;
  }, [closetBatchData]);

  // All closets for the selected client (for list view and for resolving current closet name)
  const { data: closetsForClient = [], refetch: refetchClosetsByOwner, isFetched: closetsListFetched } = useClosetsByOwner(
    selectedClientId,
    !!selectedClientId
  );
  const currentCloset = selectedClosetId ? closetsForClient.find((c: Closet) => c.id === selectedClosetId) : null;
  const currentClosetId = selectedClosetId;

  const createClosetMutation = useCreateCloset();
  const { refreshClosetsByOwner } = useRefresh();

  // Closet items only when a specific closet is selected
  const { data: rawClosetItems = [], refetch: refetchClosetItems } = useClosetItems(
    currentClosetId,
    !!currentClosetId
  );

  // Filter items for display: Items tab = all (search only); Categories detail = one category + search
  const closetItems = useMemo(() => {
    let items = rawClosetItems;
    if (mainTab === 'categories' && selectedCategoryForView) {
      items = items.filter((item: ClosetItem) => item.category === selectedCategoryForView);
    }
    if (debouncedSearch) {
      const search = debouncedSearch.toLowerCase();
      items = items.filter((item: ClosetItem) =>
        item.name.toLowerCase().includes(search) ||
        item.brand?.toLowerCase().includes(search) ||
        item.colorTags.some(color => color.toLowerCase().includes(search))
      );
    }
    return items;
  }, [rawClosetItems, debouncedSearch, mainTab, selectedCategoryForView]);

  // Item count per category (for Categories list)
  const categoryCounts = useMemo(() => {
    const counts = new Map<ItemCategory, number>();
    CATEGORIES_LIST.forEach(({ value }) => counts.set(value, 0));
    rawClosetItems.forEach((item: ClosetItem) => {
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    });
    return counts;
  }, [rawClosetItems]);

  const { refreshClients, refreshLooks } = useRefresh();

  const handleEditItem = (item: ClosetItem) => {
    setSelectedItem(item);
    showSuccess('Edit functionality coming soon');
  };

  const handleDeleteItem = async (item: ClosetItem) => {
    if (window.confirm(`Are you sure you want to delete ${item.name}?`)) {
      const success = await deleteClosetItem(item.id);
      if (success) {
        showSuccess('Item deleted');
        refetchClosetItems(); // React Query refetch
      } else {
        showError('Failed to delete item');
      }
    }
  };

  const handleArchiveItem = async (item: ClosetItem) => {
    const updated = await updateClosetItem(item.id, { archived: !item.archived });
    if (updated) {
      showSuccess(item.archived ? 'Item unarchived' : 'Item archived');
      refetchClosetItems(); // React Query refetch
    } else {
      showError('Failed to update item');
    }
  };

  const handleItemClick = (item: ClosetItem) => {
    setSelectedItem(item);
  };

  const handleClosetClick = (clientId: string) => {
    navigate(`/closets?clientId=${clientId}`);
  };

  const handleBackToClientList = () => {
    navigate('/closets');
  };

  const handleBackToClosetList = () => {
    if (isStylist) navigate(`/closets?clientId=${selectedClientId}`);
    else navigate('/closets');
  };

  const handleSelectCloset = (closetId: string) => {
    if (isStylist) navigate(`/closets?clientId=${selectedClientId}&closetId=${closetId}`);
    else navigate(`/closets?closetId=${closetId}`);
  };

  const handleAddNewCloset = async (name: string) => {
    if (!selectedClientId) return;
    const trimmed = (name ?? '').trim();
    if (!trimmed) {
      showError('Closet name is required');
      return;
    }
    const isDuplicate = closetsForClient.some(
      (c: Closet) => c.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      showError('A closet with this name already exists for this client');
      return;
    }
    try {
      const closet = await createClosetMutation.mutateAsync({ ownerId: selectedClientId, name: trimmed });
      await refreshClosetsByOwner(selectedClientId);
      handleSelectCloset(closet.id);
    } catch (e: any) {
      showError(e?.message || 'Failed to create closet');
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

  const selectedClient = isStylist ? clients.find((c: Client) => c.id === selectedClientId) : myClient;

  // If we have a closetId in URL but it's not in the client's list (invalid/deleted), go back to closet list
  useEffect(() => {
    if (closetsListFetched && selectedClosetId && selectedClientId && !currentCloset) {
      if (isStylist) navigate(`/closets?clientId=${selectedClientId}`, { replace: true });
      else navigate('/closets', { replace: true });
    }
  }, [closetsListFetched, selectedClosetId, selectedClientId, currentCloset, isStylist, navigate]);

  // Sort clients alphabetically by name
  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [clients]
  );
  // Filter clients by search (name or email) for the Closet List View
  const filteredClientsForList = useMemo(() => {
    if (!debouncedClientSearch.trim()) return sortedClients;
    const q = debouncedClientSearch.toLowerCase().trim();
    return sortedClients.filter(
      (c: Client) =>
        c.name.toLowerCase().includes(q) || (c.email && c.email.toLowerCase().includes(q))
    );
  }, [sortedClients, debouncedClientSearch]);

  // Client with no client record yet (e.g. loading or not found)
  if (!isStylist && !selectedClientId) {
    if (myClientLoading) {
      return (
        <DashboardLayout>
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </DashboardLayout>
      );
    }
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shirt className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Closet not available</h3>
            <p className="text-muted-foreground text-center">
              Your client profile is not set up yet. Please accept an invitation from your stylist first.
            </p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  // Closet List View (stylist only - when no client is selected)
  if (!selectedClientId && isStylist) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Closets</h1>
              <p className="text-sm sm:text-base text-muted-foreground">Manage client wardrobes</p>
            </div>
          </div>

          {clients.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by client name or email..."
                value={clientSearchQuery}
                onChange={(e) => setClientSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          )}

          {clients.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Shirt className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No clients yet</h3>
                <p className="text-muted-foreground text-center mb-6">
                  Add clients to start managing their closets
                </p>
                <Button onClick={() => navigate('/dashboard')}>
                  Go to Clients
                </Button>
              </CardContent>
            </Card>
          ) : filteredClientsForList.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No clients found</h3>
                <p className="text-muted-foreground text-center mb-4">
                  No clients match &quot;{debouncedClientSearch}&quot;
                </p>
                <Button variant="outline" onClick={() => setClientSearchQuery('')}>
                  Clear search
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredClientsForList.map((client: Client) => (
                <ClientClosetCard
                  key={client.id}
                  client={client}
                  itemCount={itemCountMap.get(client.id) ?? 0}
                  getInitials={getInitials}
                  onClosetClick={() => handleClosetClick(client.id)}
                />
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // Client's closet list view (client selected, no specific closet yet)
  if (selectedClientId && !selectedClosetId) {
    return (
      <DashboardLayout>
        <div className="space-y-6 -mt-1">
          <div className="flex flex-col gap-0.5">
            {isStylist && (
              <div className="flex items-center">
                <Button variant="ghost" size="icon" onClick={handleBackToClientList} aria-label="Back to clients" className="-ml-2 h-10 w-10 min-h-10 min-w-10 shrink-0 p-0">
                  <ChevronLeft className="h-7 w-7 sm:h-8 sm:w-8" />
                </Button>
              </div>
            )}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold break-words min-w-0">
                  {isStylist ? (selectedClient?.name ?? '') + "'s Closets" : 'Your Closets'}
                </h1>
                <Button onClick={() => setAddClosetDialogOpen(true)} className="shrink-0 self-start sm:self-center">
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Closet
                </Button>
              </div>
            </div>
          </div>

          {closetsForClient.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 px-6">
                <Shirt className="h-12 w-12 text-muted-foreground mb-4 shrink-0" />
                <h3 className="text-lg font-semibold mb-2 text-center">
                  No closets yet
                </h3>
                <p className="text-muted-foreground text-center max-w-md">
                  Create a closet to start adding items for {isStylist ? selectedClient?.name : 'yourself'}.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {closetsForClient.map((closet: Closet & { itemCount?: number }) => (
                <Card
                  key={closet.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleSelectCloset(closet.id)}
                >
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-lg break-words">{closet.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {(closet as Closet & { itemCount?: number }).itemCount ?? 0} item{((closet as Closet & { itemCount?: number }).itemCount ?? 0) !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Add New Closet dialog - name required, unique per client */}
          {addClosetDialogOpen && (() => {
            const trimmedName = newClosetName.trim();
            const isDuplicate = closetsForClient.some(
              (c: Closet) => c.name.trim().toLowerCase() === trimmedName.toLowerCase()
            );
            const canSubmit = trimmedName.length > 0 && !isDuplicate && !createClosetMutation.isPending;
            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setAddClosetDialogOpen(false)}>
                <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-4 space-y-4" onClick={e => e.stopPropagation()}>
                  <h3 className="font-semibold text-lg">New Closet</h3>
                  <div className="space-y-2">
                    <label htmlFor="new-closet-name" className="text-sm font-medium">Closet name *</label>
                    <Input
                      id="new-closet-name"
                      placeholder="Enter closet name"
                      value={newClosetName}
                      onChange={e => setNewClosetName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && canSubmit) {
                          handleAddNewCloset(trimmedName);
                          setAddClosetDialogOpen(false);
                          setNewClosetName('');
                        }
                      }}
                      className={isDuplicate ? 'border-destructive' : ''}
                    />
                    {trimmedName.length > 0 && isDuplicate && (
                      <p className="text-xs text-destructive">A closet with this name already exists for this client.</p>
                    )}
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => { setAddClosetDialogOpen(false); setNewClosetName(''); }}>Cancel</Button>
                    <Button onClick={() => { if (canSubmit) { handleAddNewCloset(trimmedName); setAddClosetDialogOpen(false); setNewClosetName(''); } }} disabled={!canSubmit}>
                      {createClosetMutation.isPending ? 'Creating...' : 'Create'}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </DashboardLayout>
    );
  }

  // Closet Items View (client and specific closet selected)
  return (
    <DashboardLayout>
      <div className="space-y-6 -mt-1">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" onClick={handleBackToClosetList} aria-label="Back to closet list" className="-ml-2 h-10 w-10 min-h-10 min-w-10 shrink-0 p-0">
              <ChevronLeft className="h-7 w-7 sm:h-8 sm:w-8" />
            </Button>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-row items-center justify-between gap-3 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold break-words min-w-0 flex-1">
                {currentCloset?.name ?? (isStylist ? (selectedClient?.name ?? '') + "'s Closet" : 'Your Closet')}
              </h1>
              {isStylist ? (
                <Button variant="outline" onClick={() => setCreateLookDialogOpen(true)} className="shrink-0 ml-2">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Create Look
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setRequestLookDialogOpen(true)} className="shrink-0 ml-2">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Request Look
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setBulkUploadDialogOpen(true)} className="flex-1 sm:flex-none">
                <Upload className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Bulk Upload</span>
                <span className="sm:hidden">Bulk</span>
              </Button>
              <Button onClick={() => setAddItemDialogOpen(true)} className="flex-1 sm:flex-none">
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </div>
          </div>
        </div>

        <Tabs value={mainTab} onValueChange={(v) => { setMainTab(v as 'items' | 'categories'); setSelectedCategoryForView(null); }} className="w-full">
          <TabsList className="w-full grid grid-cols-2 mb-4">
            <TabsTrigger value="items" className="min-w-0">Items</TabsTrigger>
            <TabsTrigger value="categories" className="min-w-0">Categories</TabsTrigger>
          </TabsList>

          <TabsContent value="items" className="mt-0 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, brand, or color..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            {closetItems.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 px-6">
                  <Shirt className="h-12 w-12 text-muted-foreground mb-4 shrink-0" />
                  <h3 className="text-lg font-semibold mb-2 text-center max-w-md mx-auto break-words">
                    {debouncedSearch
                      ? 'No items found'
                      : (selectedClient?.name ?? '') + "'s closet is empty"}
                  </h3>
                  <p className="text-muted-foreground text-center max-w-md mx-auto">
                    {debouncedSearch
                      ? 'Try adjusting your search'
                      : 'Start by adding items to the closet'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 min-w-0">
                {closetItems.map(item => (
                  <ClosetItemCard
                    key={item.id}
                    item={item}
                    onEdit={handleEditItem}
                    onDelete={handleDeleteItem}
                    onArchive={handleArchiveItem}
                    onClick={handleItemClick}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="categories" className="mt-0">
            {selectedCategoryForView === null ? (
              <div className="space-y-2 min-w-0">
                {CATEGORIES_LIST.map((cat) => {
                  const count = categoryCounts.get(cat.value) ?? 0;
                  return (
                    <Card
                      key={cat.value}
                      className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setSelectedCategoryForView(cat.value)}
                    >
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-base">{cat.label}</h3>
                          <p className="text-sm text-muted-foreground">
                            {count} item{count !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4 min-w-0">
                <h2 className="text-xl font-semibold">
                  {CATEGORIES_LIST.find((c) => c.value === selectedCategoryForView)?.label ?? selectedCategoryForView}
                </h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search in this category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {closetItems.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 px-6">
                      <p className="text-muted-foreground text-center">
                        {debouncedSearch ? 'No items match your search.' : 'No items in this category.'}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 min-w-0">
                    {closetItems.map(item => (
                      <ClosetItemCard
                        key={item.id}
                        item={item}
                        onEdit={handleEditItem}
                        onDelete={handleDeleteItem}
                        onArchive={handleArchiveItem}
                        onClick={handleItemClick}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {selectedClientId && currentClosetId && (
        <>
          <AddClosetItemDialog
            open={addItemDialogOpen}
            onOpenChange={setAddItemDialogOpen}
            closetId={currentClosetId}
            onItemAdded={() => refetchClosetItems()}
          />

          <BulkUploadDialog
            open={bulkUploadDialogOpen}
            onOpenChange={setBulkUploadDialogOpen}
            closetId={currentClosetId}
            onItemsAdded={() => refetchClosetItems()}
          />

          {isStylist && (
            <CreateLookDialog
              open={createLookDialogOpen}
              onOpenChange={setCreateLookDialogOpen}
              onLookCreated={async () => {
                await refreshLooks();
                navigate('/looks');
              }}
              preselectedClientId={selectedClientId}
            />
          )}
          {!isStylist && (
            <RequestLookDialog
              open={requestLookDialogOpen}
              onOpenChange={setRequestLookDialogOpen}
              closetId={currentClosetId}
              closetItems={closetItems.filter((i: ClosetItem) => !i.archived)}
              clientId={selectedClientId}
              onRequestSent={() => {
                setRequestLookDialogOpen(false);
                showSuccess('Look request sent to your stylist');
              }}
            />
          )}
        </>
      )}
    </DashboardLayout>
  );
};

export default Closets;