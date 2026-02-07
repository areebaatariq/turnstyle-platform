import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import CreateLookDialog from '@/components/CreateLookDialog';
import LookDetailDialog from '@/components/LookDetailDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Plus, Sparkles, MoreVertical, Edit, Trash2, Send, Calendar, MessageSquare, Search, ChevronDown, ChevronRight, GripVertical, Check, CircleAlert, ChevronLeft } from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
} from '@dnd-kit/core';
import { deleteLook, updateLookStatus, updateLookItem } from '@/utils/lookStorage';
import { toFullSizeImageUrl } from '@/utils/fileUpload';
import { ItemImageWithPreview } from '@/components/ItemImagePreview';
import { getCurrentUser } from '@/utils/auth';
import { showSuccess, showError } from '@/utils/toast';
import { Look, LookStatus, Client, ClosetItem, LookRequest } from '@/types';
import { format } from 'date-fns';
import { useLooksWithItems, useClients, useLookRequests, useRefresh } from '@/hooks/useQueries';
import { useDebounce } from '@/hooks/useDebounce';

// Pagination constants
const LOOKS_PER_PAGE = 3;

const Looks = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUser = getCurrentUser();
  const isStylist = currentUser?.userType === 'stylist';
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<LookStatus | 'all'>('all');
  const [selectedLook, setSelectedLook] = useState<Look | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [clientMainTab, setClientMainTab] = useState<'looks' | 'requested'>('looks');
  const debouncedSearch = useDebounce(searchQuery, 300);
  
  // Per-client search and pagination state
  const [clientSearchQueries, setClientSearchQueries] = useState<Map<string, string>>(new Map());
  const [clientCurrentPages, setClientCurrentPages] = useState<Map<string, number>>(new Map());
  
  // Debounced client search queries
  const [debouncedClientSearches, setDebouncedClientSearches] = useState<Map<string, string>>(new Map());
  
  // Debounce effect for client searches
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedClientSearches(new Map(clientSearchQueries));
      // Reset pagination when search changes
      const newPages = new Map<string, number>();
      clientSearchQueries.forEach((_, clientId) => {
        newPages.set(clientId, 1);
      });
      if (newPages.size > 0) {
        setClientCurrentPages(prev => {
          const updated = new Map(prev);
          newPages.forEach((_, clientId) => {
            // Only reset if search actually changed
            if (clientSearchQueries.get(clientId) !== debouncedClientSearches.get(clientId)) {
              updated.set(clientId, 1);
            }
          });
          return updated;
        });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearchQueries]);
  
  // Helper to get/set client search
  const getClientSearch = useCallback((clientId: string) => {
    return clientSearchQueries.get(clientId) || '';
  }, [clientSearchQueries]);
  
  const setClientSearch = useCallback((clientId: string, query: string) => {
    setClientSearchQueries(prev => {
      const next = new Map(prev);
      next.set(clientId, query);
      return next;
    });
  }, []);
  
  // Helper to get/set client page
  const getClientPage = useCallback((clientId: string) => {
    return clientCurrentPages.get(clientId) || 1;
  }, [clientCurrentPages]);
  
  const setClientPage = useCallback((clientId: string, page: number) => {
    setClientCurrentPages(prev => {
      const next = new Map(prev);
      next.set(clientId, page);
      return next;
    });
  }, []);
  
  // Reset all client pages when status filter changes
  useEffect(() => {
    setClientCurrentPages(new Map());
  }, [selectedStatus]);

  // React Query - fetches looks with all items in ONE request (eliminates N+1)
  const { data: looksWithItemsData = [], refetch: refetchLooks } = useLooksWithItems();
  const { data: clients = [] } = useClients();
  const { data: lookRequests = [] } = useLookRequests() as { data: (LookRequest & { items?: ClosetItem[] })[] };
  const { refreshLooks } = useRefresh();

  // Extract looks from the combined data
  const looks = useMemo(() => {
    return looksWithItemsData.map((item: any) => ({
      id: item.id,
      name: item.name,
      clientId: item.clientId,
      stylistId: item.stylistId,
      status: item.status,
      occasion: item.occasion,
      eventDate: item.eventDate,
      stylingNotes: item.stylingNotes,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }, [looksWithItemsData]);

  // Look items with order and ids for reordering (id, sortOrder, closetItem)
  const lookItemsWithOrderMap = useMemo(() => {
    const map = new Map<string, { lookItemId: string; sortOrder: number; closetItem: ClosetItem }[]>();
    looksWithItemsData.forEach((look: any) => {
      const raw = (look.items || [])
        .map((item: any) => {
          const closetItem = item.closetItem || item.newItemDetails;
          if (!closetItem) return null;
          return {
            lookItemId: item.id,
            sortOrder: item.sortOrder ?? 0,
            closetItem,
          };
        })
        .filter(Boolean) as { lookItemId: string; sortOrder: number; closetItem: ClosetItem }[];
      raw.sort((a, b) => a.sortOrder - b.sortOrder);
      map.set(look.id, raw);
    });
    return map;
  }, [looksWithItemsData]);

  // Create a map for client lookup
  const clientsMap = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach(client => map.set(client.id, client));
    // Also add clients from look data (for client users)
    looksWithItemsData.forEach((look: any) => {
      if (look.client && !map.has(look.clientId)) {
        map.set(look.clientId, look.client);
      }
    });
    return map;
  }, [clients, looksWithItemsData]);

  // Group looks by client (for stylist view)
  const looksByClient = useMemo(() => {
    const grouped = new Map<string, Look[]>();
    looks.forEach(look => {
      const clientLooks = grouped.get(look.clientId) || [];
      clientLooks.push(look);
      grouped.set(look.clientId, clientLooks);
    });
    return grouped;
  }, [looks]);

  // Get clients that have looks, filtered by search
  const clientsWithLooks = useMemo(() => {
    const clientIds = Array.from(looksByClient.keys());
    let filteredClients = clientIds
      .map(id => clientsMap.get(id))
      .filter((client): client is Client => client !== undefined);
    
    // Apply search filter
    if (debouncedSearch.trim()) {
      const searchLower = debouncedSearch.toLowerCase();
      filteredClients = filteredClients.filter(client => 
        client.name.toLowerCase().includes(searchLower) ||
        client.email.toLowerCase().includes(searchLower)
      );
    }
    
    // Sort alphabetically by name
    return filteredClients.sort((a, b) => a.name.localeCompare(b.name));
  }, [looksByClient, clientsMap, debouncedSearch]);

  // Auto-expand all clients initially
  useEffect(() => {
    if (clientsWithLooks.length > 0 && expandedClients.size === 0) {
      setExpandedClients(new Set(clientsWithLooks.map(c => c.id)));
    }
  }, [clientsWithLooks]);

  // Toggle client section expand/collapse
  const toggleClientExpanded = (clientId: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  // Check for first-time user when lookId is in URL (from email link)
  useEffect(() => {
    const lookIdFromUrl = searchParams.get('lookId');
    if (lookIdFromUrl && !currentUser) {
      // User not logged in, check if they need to sign up
      checkLookAccess(lookIdFromUrl);
    }
  }, [searchParams, currentUser, navigate]);

  // Auto-open look if lookId is in URL (from email link) and user is logged in
  // For stylists: just navigate to Looks page (look is visible in client sections)
  // For clients: open the look detail dialog
  useEffect(() => {
    const lookIdFromUrl = searchParams.get('lookId');
    if (lookIdFromUrl && looks.length > 0 && currentUser) {
      const look = looks.find(l => l.id === lookIdFromUrl);
      if (look) {
        // Only open dialog for clients - stylists see looks directly in client sections
        if (!isStylist) {
          setSelectedLook(look);
          setDetailDialogOpen(true);
        }
        // Clean up URL after handling
        navigate('/looks', { replace: true });
      }
    }
  }, [looks, searchParams, navigate, currentUser, isStylist]);

  const checkLookAccess = async (lookId: string) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const response = await fetch(`${API_URL}/looks/public/${lookId}/check`);
      
      if (!response.ok) {
        throw new Error('Failed to check look access');
      }
      
      const result = await response.json();
      const { clientEmail, clientName, userExists } = result.data;
      
      if (!userExists) {
        // First-time user - redirect to signup with email pre-filled
        const redirectUrl = encodeURIComponent(`/looks?lookId=${lookId}`);
        navigate(`/signup?email=${encodeURIComponent(clientEmail)}&userType=client&redirect=${redirectUrl}`);
      } else {
        // User exists but not logged in - redirect to login
        const redirectUrl = encodeURIComponent(`/looks?lookId=${lookId}`);
        navigate(`/login?redirect=${redirectUrl}`);
      }
    } catch (error) {
      console.error('Error checking look access:', error);
      // Fallback: redirect to login
      const redirectUrl = encodeURIComponent(`/looks?lookId=${lookId}`);
      navigate(`/login?redirect=${redirectUrl}`);
    }
  };

  // Get client by ID (uses pre-built map)
  const getClient = (clientId: string): Client | undefined => {
    return clientsMap.get(clientId);
  };

  // Get items for a look (uses pre-built map - no async needed!)
  const getLookItemsWithOrder = (lookId: string): { lookItemId: string; sortOrder: number; closetItem: ClosetItem }[] => {
    return lookItemsWithOrderMap.get(lookId) || [];
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusBadge = (status: LookStatus) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500">Pending Approval</Badge>;
      case 'approved':
        return <Badge className="bg-green-500">Approved</Badge>;
      case 'changes_requested':
        return <Badge className="bg-orange-500">Changes Requested</Badge>;
    }
  };

  const handleDeleteLook = async (look: Look, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${look.name}"?`)) {
      const success = await deleteLook(look.id);
      if (success) {
        showSuccess('Look deleted');
        refreshLooks(); // React Query refetch
      } else {
        showError('Failed to delete look');
      }
    }
  };

  const handleSendForApproval = async (look: Look, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = await updateLookStatus(look.id, 'pending');
    if (updated) {
      showSuccess(`Look sent to ${getClient(look.clientId)?.name} for approval`);
      refreshLooks(); // React Query refetch
    } else {
      showError('Failed to send look');
    }
  };

  // Simplified handlers for onSelect (no event parameter needed)
  const handleDeleteLookSimple = async (look: Look) => {
    if (window.confirm(`Are you sure you want to delete "${look.name}"?`)) {
      const success = await deleteLook(look.id);
      if (success) {
        showSuccess('Look deleted');
        refreshLooks(); // React Query refetch
      } else {
        showError('Failed to delete look');
      }
    }
  };

  const handleSendForApprovalSimple = async (look: Look) => {
    const updated = await updateLookStatus(look.id, 'pending');
    if (updated) {
      showSuccess(`Look sent to ${getClient(look.clientId)?.name} for approval`);
      refreshLooks(); // React Query refetch
    } else {
      showError('Failed to send look');
    }
  };

  const handleEditFromDropdownSimple = (look: Look) => {
    setSelectedLook(look);
    setEditDialogOpen(true);
  };

  const handleDeleteFromDetail = async () => {
    if (!selectedLook) return;
    if (window.confirm(`Are you sure you want to delete "${selectedLook.name}"?`)) {
      const success = await deleteLook(selectedLook.id);
      if (success) {
        showSuccess('Look deleted');
        setDetailDialogOpen(false);
        setSelectedLook(null);
        refreshLooks(); // React Query refetch
      } else {
        showError('Failed to delete look');
      }
    }
  };

  const handleSendForApprovalFromDetail = async () => {
    if (!selectedLook) return;
    const updated = await updateLookStatus(selectedLook.id, 'pending');
    if (updated) {
      showSuccess(`Look sent to ${getClient(selectedLook.clientId)?.name} for approval`);
      setDetailDialogOpen(false);
      setSelectedLook(null);
      refreshLooks(); // React Query refetch
    } else {
      showError('Failed to send look');
    }
  };

  const handleMessageFromDetail = () => {
    if (!selectedLook) return;
    
    // Only allow messaging for non-draft looks (chat room exists after sending for approval)
    if (selectedLook.status === 'draft') {
      showError('Send the look for approval first to start a conversation');
      return;
    }
    
    setDetailDialogOpen(false);
    navigate(`/messages?lookId=${selectedLook.id}`);
  };

  const handleEditFromDetail = () => {
    setDetailDialogOpen(false);
    setEditDialogOpen(true);
  };

  const handleEditFromDropdown = (look: Look, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedLook(look);
    setEditDialogOpen(true);
  };

  const filteredLooks = selectedStatus === 'all' 
    ? looks 
    : looks.filter(look => look.status === selectedStatus);

  const looksByStatus = {
    draft: looks.filter(l => l.status === 'draft'),
    pending: looks.filter(l => l.status === 'pending'),
    approved: looks.filter(l => l.status === 'approved'),
    changes_requested: looks.filter(l => l.status === 'changes_requested'),
  };

  const LookGridItem = ({
    lookItemId,
    closetItem,
    isDraggable,
  }: {
    lookItemId: string;
    closetItem: ClosetItem;
    isDraggable: boolean;
  }) => {
    const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
      id: lookItemId,
      data: { lookItemId },
    });
    const { setNodeRef: setDropRef, isOver } = useDroppable({ id: lookItemId });

    const setRef = (node: HTMLDivElement | null) => {
      setDragRef(node);
      setDropRef(node);
    };

    const cell = (
      <div
        ref={setRef}
        className={`aspect-square rounded overflow-hidden border transition-shadow ${
          isOver ? 'ring-2 ring-primary ring-offset-1' : ''
        } ${isDragging ? 'opacity-60 z-10' : ''}`}
      >
        <div className="relative w-full h-full bg-white">
          {isDraggable && (
            <div
              className="absolute top-0.5 left-0.5 z-10 p-0.5 rounded bg-black/50 text-white cursor-grab active:cursor-grabbing touch-none"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-3 w-3" />
            </div>
          )}
          <ItemImageWithPreview
            photoUrl={closetItem.photoUrl}
            alt={closetItem.name}
            caption={closetItem.name}
            className="w-full h-full object-contain"
            draggable={false}
          />
        </div>
      </div>
    );
    return cell;
  };

  const handleLookItemsDragEnd = (lookId: string) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const items = getLookItemsWithOrder(lookId);
    const fromIndex = items.findIndex((i) => i.lookItemId === active.id);
    const toIndex = items.findIndex((i) => i.lookItemId === over.id);
    if (fromIndex === -1 || toIndex === -1) return;
    const newOrder = [...items];
    const [removed] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, removed);
    Promise.all(
      newOrder.map((entry, index) => updateLookItem(entry.lookItemId, { sortOrder: index }))
    ).then(() => {
      refreshLooks();
      showSuccess('Look order updated');
    }).catch(() => showError('Failed to update order'));
  };

  const LookCard = ({ look }: { look: Look }) => {
    const items = getLookItemsWithOrder(look.id);
    const canReorder = isStylist && (look.status === 'draft' || look.status === 'changes_requested');
    const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    return (
      <Card className="overflow-hidden transition-shadow hover:shadow-md">
        <CardContent className="p-4 sm:p-5">
          {/* Single unified block: title, status, menu, and images together */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold">{look.name}</h3>
              {!isStylist && (
                <p className="text-sm text-muted-foreground mt-0.5">From Your Stylist</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {getStatusBadge(look.status)}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isStylist ? (
                    <>
                      {look.status === 'draft' && (
                        <DropdownMenuItem onSelect={() => handleSendForApprovalSimple(look)}>
                          <Send className="mr-2 h-4 w-4" />
                          Send for Approval
                        </DropdownMenuItem>
                      )}
                      {(look.status === 'draft' || look.status === 'changes_requested') && (
                        <DropdownMenuItem onSelect={() => handleEditFromDropdownSimple(look)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Look
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem 
                        onSelect={() => {
                          if (look.status !== 'draft') {
                            navigate(`/messages?lookId=${look.id}`); 
                          } else {
                            showError('Send the look for approval first to start a conversation');
                          }
                        }}
                        disabled={look.status === 'draft'}
                      >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Message Client
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => handleDeleteLookSimple(look)}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Look
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      {look.status === 'pending' && (
                        <>
                          <DropdownMenuItem
                            onSelect={async () => {
                              const updated = await updateLookStatus(look.id, 'approved');
                              if (updated) {
                                showSuccess('Look approved!');
                                await refreshLooks();
                              } else {
                                showError('Failed to approve look');
                              }
                            }}
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Approve Look
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={async () => {
                              const updated = await updateLookStatus(look.id, 'changes_requested');
                              if (updated) {
                                showSuccess('Changes requested. Your stylist will be notified.');
                                await refreshLooks();
                              } else {
                                showError('Failed to request changes');
                              }
                            }}
                          >
                            <CircleAlert className="mr-2 h-4 w-4" />
                            Request Changes
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuItem onSelect={() => navigate(`/messages?lookId=${look.id}`)}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Message Stylist
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Images integrated in same card — no separate bordered section */}
          {look.compositeImageUrl ? (
            <div className="rounded-lg overflow-hidden bg-white">
              <img
                src={look.compositeImageUrl}
                alt={look.name}
                className="w-full min-h-[320px] sm:min-h-[260px] object-contain"
              />
            </div>
          ) : items.length > 0 ? (
            canReorder ? (
              <DndContext
                sensors={sensors}
                collisionDetection={pointerWithin}
                onDragEnd={handleLookItemsDragEnd(look.id)}
              >
                <div className="grid grid-cols-2 gap-1 min-h-0">
                  {items.map(({ lookItemId, closetItem }) => (
                    <LookGridItem
                      key={lookItemId}
                      lookItemId={lookItemId}
                      closetItem={closetItem}
                      isDraggable
                    />
                  ))}
                </div>
              </DndContext>
            ) : (
              <div className="grid grid-cols-2 gap-1 min-h-0">
                {items.map(({ lookItemId, closetItem }) => (
                  <LookGridItem
                    key={lookItemId}
                    lookItemId={lookItemId}
                    closetItem={closetItem}
                    isDraggable={false}
                  />
                ))}
              </div>
            )
          ) : (
            <div className="rounded-lg bg-muted/20 flex items-center justify-center min-h-[120px] text-muted-foreground text-sm">
              No items in this look
            </div>
          )}

          {/* Optional meta and notes below images, compact */}
          {(look.occasion || look.eventDate) && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {look.occasion && <span>{look.occasion}</span>}
              {look.eventDate && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(new Date(look.eventDate), 'MMM d, yyyy')}
                </span>
              )}
            </div>
          )}

          {look.stylingNotes && (
            <p className="text-sm text-muted-foreground mt-3 whitespace-pre-wrap border-t pt-3">
              {look.stylingNotes}
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  // Get looks for a specific client filtered by status and search
  const getClientLooksFiltered = useCallback((clientId: string) => {
    let clientLooks = looksByClient.get(clientId) || [];
    
    // Filter by status
    if (selectedStatus !== 'all') {
      clientLooks = clientLooks.filter(look => look.status === selectedStatus);
    }
    
    // Filter by client-specific search query
    const searchQuery = debouncedClientSearches.get(clientId)?.toLowerCase().trim();
    if (searchQuery) {
      clientLooks = clientLooks.filter(look => 
        look.name.toLowerCase().includes(searchQuery) ||
        (look.occasion && look.occasion.toLowerCase().includes(searchQuery)) ||
        (look.stylingNotes && look.stylingNotes.toLowerCase().includes(searchQuery))
      );
    }
    
    return clientLooks;
  }, [looksByClient, selectedStatus, debouncedClientSearches]);
  
  // Get paginated looks for a client
  const getClientLooksPaginated = useCallback((clientId: string) => {
    const filteredLooks = getClientLooksFiltered(clientId);
    const currentPage = getClientPage(clientId);
    const startIndex = (currentPage - 1) * LOOKS_PER_PAGE;
    const endIndex = startIndex + LOOKS_PER_PAGE;
    return filteredLooks.slice(startIndex, endIndex);
  }, [getClientLooksFiltered, getClientPage]);
  
  // Get total pages for a client
  const getClientTotalPages = useCallback((clientId: string) => {
    const filteredLooks = getClientLooksFiltered(clientId);
    return Math.ceil(filteredLooks.length / LOOKS_PER_PAGE);
  }, [getClientLooksFiltered]);
  
  // Generate page numbers to display (with ellipsis for many pages)
  const getPageNumbers = useCallback((currentPage: number, totalPages: number): (number | 'ellipsis')[] => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    
    const pages: (number | 'ellipsis')[] = [];
    
    // Always show first page
    pages.push(1);
    
    if (currentPage > 3) {
      pages.push('ellipsis');
    }
    
    // Show pages around current page
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    if (currentPage < totalPages - 2) {
      pages.push('ellipsis');
    }
    
    // Always show last page
    if (totalPages > 1) {
      pages.push(totalPages);
    }
    
    return pages;
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Looks</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              {isStylist ? 'Manage and track all your styling looks' : 'View your styling looks'}
            </p>
          </div>
          {isStylist && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Look
            </Button>
          )}
        </div>

        {looks.length === 0 && isStylist ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No looks yet</h3>
              <p className="text-muted-foreground text-center">
                Use the Create Look button above to get started.
              </p>
            </CardContent>
          </Card>
        ) : isStylist ? (
          // Stylist view - grouped by client
          <div className="space-y-4">
            {/* Search and filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Status filter tabs - single row, equal width, no scroll */}
            <Tabs value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as LookStatus | 'all')}>
              <TabsList className="w-full grid grid-cols-5 gap-1 p-1.5 sm:gap-2 sm:p-2 min-h-9 sm:min-h-10">
                <TabsTrigger value="all" className="min-w-0 text-[11px] sm:text-xs md:text-sm truncate px-1.5 py-1 sm:px-2 sm:py-1.5" title={`All (${looks.length})`}>
                  All ({looks.length})
                </TabsTrigger>
                <TabsTrigger value="draft" className="min-w-0 text-[11px] sm:text-xs md:text-sm truncate px-1.5 py-1 sm:px-2 sm:py-1.5" title={`Drafts (${looksByStatus.draft.length})`}>
                  Drafts ({looksByStatus.draft.length})
                </TabsTrigger>
                <TabsTrigger value="pending" className="min-w-0 text-[11px] sm:text-xs md:text-sm truncate px-1.5 py-1 sm:px-2 sm:py-1.5" title={`Pending (${looksByStatus.pending.length})`}>
                  Pending ({looksByStatus.pending.length})
                </TabsTrigger>
                <TabsTrigger value="approved" className="min-w-0 text-[11px] sm:text-xs md:text-sm truncate px-1.5 py-1 sm:px-2 sm:py-1.5" title={`Approved (${looksByStatus.approved.length})`}>
                  Approved ({looksByStatus.approved.length})
                </TabsTrigger>
                <TabsTrigger value="changes_requested" className="min-w-0 text-[11px] sm:text-xs md:text-sm truncate px-1.5 py-1 sm:px-2 sm:py-1.5" title={`Changes (${looksByStatus.changes_requested.length})`}>
                  Changes ({looksByStatus.changes_requested.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Client sections */}
            {clientsWithLooks.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Search className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No clients found matching "{debouncedSearch}"
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {clientsWithLooks.map(client => {
                  const clientLooksFiltered = getClientLooksFiltered(client.id);
                  const clientLooksPaginated = getClientLooksPaginated(client.id);
                  const allClientLooks = looksByClient.get(client.id) || [];
                  const isExpanded = expandedClients.has(client.id);
                  const currentPage = getClientPage(client.id);
                  const totalPages = getClientTotalPages(client.id);
                  const clientSearchQuery = getClientSearch(client.id);
                  
                  // Skip clients with no looks matching the status filter (but show if searching)
                  if (clientLooksFiltered.length === 0 && selectedStatus !== 'all' && !clientSearchQuery) {
                    return null;
                  }

                  return (
                    <Card key={client.id} className="overflow-hidden">
                      <Collapsible open={isExpanded} onOpenChange={() => toggleClientExpanded(client.id)}>
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-100 transition-colors">
                            <div className="flex items-center gap-3">
                              {isExpanded ? (
                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                              )}
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={client.profilePhotoUrl} />
                                <AvatarFallback>{getInitials(client.name)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <h3 className="font-semibold">{client.name}</h3>
                                <p className="text-sm text-muted-foreground">{client.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">
                                {clientLooksFiltered.length} {clientLooksFiltered.length === 1 ? 'look' : 'looks'}
                                {selectedStatus !== 'all' && ` (${allClientLooks.length} total)`}
                              </Badge>
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="border-t">
                            {/* Client-specific search bar */}
                            {allClientLooks.length > 0 && (
                              <div className="p-4 pb-2">
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    placeholder="Search looks by name, occasion, notes..."
                                    value={clientSearchQuery}
                                    onChange={(e) => setClientSearch(client.id, e.target.value)}
                                    className="pl-10"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              </div>
                            )}
                            
                            {clientLooksFiltered.length === 0 ? (
                              <div className="p-6 text-center text-muted-foreground">
                                {clientSearchQuery ? (
                                  <>No looks found matching "{clientSearchQuery}"</>
                                ) : (
                                  <>No {selectedStatus === 'all' ? '' : selectedStatus} looks for this client</>
                                )}
                              </div>
                            ) : (
                              <>
                                <div className="p-4 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
                                  {clientLooksPaginated.map(look => (
                                    <LookCard key={look.id} look={look} />
                                  ))}
                                </div>
                                
                                {/* Pagination controls */}
                                {totalPages > 1 && (
                                  <div className="px-4 pb-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t pt-4">
                                    <p className="text-sm text-muted-foreground">
                                      Showing {((currentPage - 1) * LOOKS_PER_PAGE) + 1}-{Math.min(currentPage * LOOKS_PER_PAGE, clientLooksFiltered.length)} of {clientLooksFiltered.length} looks
                                    </p>
                                    <div className="flex items-center gap-1 sm:gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setClientPage(client.id, currentPage - 1);
                                        }}
                                        disabled={currentPage === 1}
                                        className="px-2 sm:px-3"
                                      >
                                        <ChevronLeft className="h-4 w-4 sm:mr-1" />
                                        <span className="hidden sm:inline">Previous</span>
                                      </Button>
                                      <div className="flex items-center gap-1">
                                        {getPageNumbers(currentPage, totalPages).map((page, idx) => (
                                          page === 'ellipsis' ? (
                                            <span key={`ellipsis-${idx}`} className="px-1 sm:px-2 text-muted-foreground">...</span>
                                          ) : (
                                            <Button
                                              key={page}
                                              variant={page === currentPage ? "default" : "outline"}
                                              size="sm"
                                              className="w-7 h-7 sm:w-8 sm:h-8 p-0 text-xs sm:text-sm"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setClientPage(client.id, page);
                                              }}
                                            >
                                              {page}
                                            </Button>
                                          )
                                        ))}
                                      </div>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setClientPage(client.id, currentPage + 1);
                                        }}
                                        disabled={currentPage === totalPages}
                                        className="px-2 sm:px-3"
                                      >
                                        <span className="hidden sm:inline">Next</span>
                                        <ChevronRight className="h-4 w-4 sm:ml-1" />
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          // Client view - Looks and Requested Looks tabs
          <Tabs value={clientMainTab} onValueChange={(v) => setClientMainTab(v as 'looks' | 'requested')}>
            <TabsList className="w-full grid grid-cols-2 gap-2 max-w-md">
              <TabsTrigger value="looks" className="whitespace-nowrap">
                Looks ({looks.length})
              </TabsTrigger>
              <TabsTrigger value="requested" className="whitespace-nowrap">
                Requested Looks ({lookRequests.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="looks" className="mt-6">
              {looks.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No looks yet</h3>
                    <p className="text-muted-foreground text-center">
                      Your stylist hasn&apos;t created any looks for you yet
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Tabs value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as LookStatus | 'all')}>
                  <TabsList className="w-full grid grid-cols-4 gap-1 p-1.5 sm:gap-2 sm:p-2 min-h-9 sm:min-h-10 mb-4">
                    <TabsTrigger value="all" className="min-w-0 text-[11px] sm:text-xs md:text-sm truncate px-1.5 py-1 sm:px-2 sm:py-1.5" title={`All (${looks.length})`}>
                      All ({looks.length})
                    </TabsTrigger>
                    <TabsTrigger value="pending" className="min-w-0 text-[11px] sm:text-xs md:text-sm truncate px-1.5 py-1 sm:px-2 sm:py-1.5" title={`Pending (${looksByStatus.pending.length})`}>
                      Pending ({looksByStatus.pending.length})
                    </TabsTrigger>
                    <TabsTrigger value="approved" className="min-w-0 text-[11px] sm:text-xs md:text-sm truncate px-1.5 py-1 sm:px-2 sm:py-1.5" title={`Approved (${looksByStatus.approved.length})`}>
                      Approved ({looksByStatus.approved.length})
                    </TabsTrigger>
                    <TabsTrigger value="changes_requested" className="min-w-0 text-[11px] sm:text-xs md:text-sm truncate px-1.5 py-1 sm:px-2 sm:py-1.5" title={`Changes (${looksByStatus.changes_requested.length})`}>
                      Changes ({looksByStatus.changes_requested.length})
                    </TabsTrigger>
                  </TabsList>
                  {(['all', 'pending', 'approved', 'changes_requested'] as const).map((status) => {
                    const list = status === 'all' ? looks : looks.filter((l) => l.status === status);
                    return (
                      <TabsContent key={status} value={status} className="mt-0">
                        {list.length === 0 ? (
                          <Card>
                            <CardContent className="py-12 text-center text-muted-foreground">
                              No {status === 'all' ? '' : status} looks found
                            </CardContent>
                          </Card>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
                            {list.map((look) => (
                              <LookCard key={look.id} look={look} />
                            ))}
                          </div>
                        )}
                      </TabsContent>
                    );
                  })}
                </Tabs>
              )}
            </TabsContent>

            <TabsContent value="requested" className="mt-6">
              {lookRequests.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No requested looks yet</h3>
                    <p className="text-muted-foreground text-center max-w-md">
                      When you request a look from your closet (Closets → Request Look), your requests will appear here. Your stylist can accept and create looks from them.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {lookRequests.map((req) => {
                    const requestItems = (req as LookRequest & { items?: ClosetItem[] }).items ?? [];
                    return (
                      <Card key={req.id}>
                        <CardContent className="p-4">
                          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                  variant={req.status === 'completed' ? 'default' : req.status === 'declined' ? 'destructive' : 'secondary'}
                                  className={
                                    req.status === 'in_progress' ? 'bg-blue-500' :
                                    req.status === 'completed' ? 'bg-green-500' : ''
                                  }
                                >
                                  {req.status === 'pending' && 'Pending'}
                                {req.status === 'in_progress' && 'Accepted'}
                                {req.status === 'completed' && 'Request Fulfilled'}
                                  {req.status === 'declined' && 'Declined'}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {req.itemIds.length} item{req.itemIds.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                <Calendar className="h-4 w-4" />
                                {format(new Date(req.createdAt), 'MMM d, yyyy')}
                              </div>
                              {req.message && (
                                <p className="text-sm mt-1 text-muted-foreground line-clamp-2">{req.message}</p>
                              )}
                            </div>
                            {requestItems.length > 0 && (
                              <div className="flex gap-1 overflow-x-auto flex-shrink-0 max-w-full sm:max-w-[280px]">
                                {requestItems.slice(0, 6).map((item) => (
                                  <div
                                    key={item.id}
                                    className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-muted"
                                  >
                                    <ItemImageWithPreview
                                      photoUrl={item.photoUrl}
                                      alt={item.name}
                                      caption={item.name}
                                      className="w-full h-full object-contain"
                                    />
                                  </div>
                                ))}
                                {requestItems.length > 6 && (
                                  <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center text-xs flex-shrink-0">
                                    +{requestItems.length - 6}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <CreateLookDialog
        open={createDialogOpen || editDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false);
            setEditDialogOpen(false);
          }
        }}
        onLookCreated={async () => {
          await refreshLooks();
        }}
        editLook={editDialogOpen ? selectedLook : null}
        onLookUpdated={async () => {
          await refreshLooks();
        }}
      />

          <LookDetailDialog
            open={detailDialogOpen}
            onOpenChange={setDetailDialogOpen}
            look={selectedLook}
            onDelete={isStylist ? handleDeleteFromDetail : undefined}
            onSendForApproval={isStylist && selectedLook?.status === 'draft' ? handleSendForApprovalFromDetail : undefined}
            onMessageClient={() => {
              if (selectedLook) {
                // Only allow messaging for non-draft looks
                if (selectedLook.status === 'draft') {
                  showError('Send the look for approval first to start a conversation');
                  return;
                }
                setDetailDialogOpen(false);
                navigate(`/messages?lookId=${selectedLook.id}`);
              }
            }}
            onEdit={isStylist && selectedLook && (selectedLook.status === 'draft' || selectedLook.status === 'changes_requested') ? handleEditFromDetail : undefined}
            onStatusChange={async () => {
              refreshLooks();
              if (selectedLook) {
                const updated = looks.find(l => l.id === selectedLook.id);
                if (updated) setSelectedLook(updated);
              }
            }}
          />

    </DashboardLayout>
  );
};

export default Looks;