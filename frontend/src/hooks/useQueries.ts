/**
 * React Query hooks for data fetching with caching and automatic updates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStylistClients, getMyClient, addClient, updateClient, deleteClient } from '@/utils/clientStorage';
import { getOrCreateCloset, getClosetsByOwner, createCloset, getClosetItems, addClosetItem, updateClosetItem, deleteClosetItem } from '@/utils/closetStorage';
import { getStylistLooks, createLook, updateLook, deleteLook } from '@/utils/lookStorage';
import { getChatRooms, getChatRoomMessages, sendMessage, markChatRoomAsRead } from '@/utils/messageStorage';
import { getCurrentUser } from '@/utils/auth';
import { Client, ClosetItem, Look } from '@/types';
import { api } from '@/utils/api';

// Query Keys - centralized for consistency
// Closet keys include userId so each account has independent cache (closets are scoped per stylist)
export const queryKeys = {
  clients: ['clients'] as const,
  client: (id: string) => ['clients', id] as const,
  
  closet: (userId: string, clientId: string) => ['closets', userId, clientId] as const,
  closetsByOwner: (ownerId: string) => ['closetsByOwner', ownerId] as const,
  closetItems: (closetId: string) => ['closetItems', closetId] as const,
  closetBatch: (userId: string, clientIds: string[]) => ['closetBatch', userId, ...clientIds] as const,
  allClosetItems: ['allClosetItems'] as const,
  
  looks: ['looks'] as const,
  looksWithItems: ['looksWithItems'] as const,
  look: (id: string) => ['looks', id] as const,
  lookItems: (lookId: string) => ['lookItems', lookId] as const,
  
  chatRooms: ['chatRooms'] as const,
  chatRoomMessages: (chatRoomId: string) => ['messages', chatRoomId] as const,

  lookRequests: ['lookRequests'] as const,
};

// ==================== BOOTSTRAP ====================

/** Fetch all core data in one request and hydrate cache for instant subsequent reads */
export function useBootstrap() {
  const queryClient = useQueryClient();
  const userId = getCurrentUser()?.id ?? '';

  return useQuery({
    queryKey: ['bootstrap', userId],
    queryFn: async () => {
      try {
        const response = await api.get<{ data?: { clients?: Client[]; myClient?: Client | null; closetBatch?: any[]; looksWithItems?: any[]; chatRooms?: any[] } }>('/bootstrap');
        const payload = response?.data ?? response;
        if (!payload || typeof payload !== 'object') {
          return { clients: [], myClient: null, closetBatch: [], looksWithItems: [], chatRooms: [] };
        }
        const clients: Client[] = Array.isArray(payload.clients) ? payload.clients : [];
        const myClient = payload.myClient ?? null;
        const closetBatch = Array.isArray(payload.closetBatch) ? payload.closetBatch : [];
        const looksWithItems = Array.isArray(payload.looksWithItems) ? payload.looksWithItems : [];
        const chatRooms = Array.isArray(payload.chatRooms) ? payload.chatRooms : [];

        // Hydrate cache so useClients, useLooksWithItems, useMyClient, etc. return instantly
        queryClient.setQueryData(queryKeys.clients, clients);
        if (myClient) queryClient.setQueryData(['myClient', userId], myClient);
        queryClient.setQueryData(queryKeys.looksWithItems, looksWithItems);
        queryClient.setQueryData(queryKeys.chatRooms, chatRooms);

        // looks = plain array derived from looksWithItems (for useLooks/Dashboard)
        const looks = looksWithItems.map((l: any) => ({
          id: l.id,
          name: l.name,
          clientId: l.clientId,
          stylistId: l.stylistId,
          status: l.status,
          occasion: l.occasion,
          eventDate: l.eventDate,
          stylingNotes: l.stylingNotes,
          compositeImageUrl: l.compositeImageUrl,
          createdAt: l.createdAt,
          updatedAt: l.updatedAt,
        }));
        queryClient.setQueryData(queryKeys.looks, looks);

        const clientIds = clients.map((c: Client) => c.id);
        if (clientIds.length > 0) {
          queryClient.setQueryData(queryKeys.closetBatch(userId, clientIds), closetBatch);
        }

        return { clients, myClient, closetBatch, looksWithItems, chatRooms };
      } catch (err) {
        console.error('Bootstrap failed:', err);
        throw err;
      }
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 min
    gcTime: 10 * 60 * 1000,   // 10 min
    retry: false, // Don't retry on 404 (old backend without bootstrap)
  });
}

// ==================== CLIENTS ====================

export function useClients() {
  return useQuery({
    queryKey: queryKeys.clients,
    queryFn: getStylistClients,
  });
}

export function useMyClient() {
  const userId = getCurrentUser()?.id ?? '';
  const isClient = getCurrentUser()?.userType === 'client';
  return useQuery({
    queryKey: ['myClient', userId],
    queryFn: getMyClient,
    enabled: !!userId && isClient,
  });
}

export function useAddClient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (clientData: Omit<Client, 'id'>) => addClient(clientData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Client> }) => 
      updateClient(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients });
    },
  });
}

// ==================== CLOSETS ====================

export function useCloset(clientId: string, enabled = true) {
  const userId = getCurrentUser()?.id ?? '';
  return useQuery({
    queryKey: queryKeys.closet(userId, clientId),
    queryFn: () => getOrCreateCloset(clientId),
    enabled: enabled && !!clientId && !!userId,
  });
}

/** All closets for a client (owner). Use for Client → Closets list screen. */
export function useClosetsByOwner(ownerId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.closetsByOwner(ownerId),
    queryFn: () => getClosetsByOwner(ownerId),
    enabled: enabled && !!ownerId,
  });
}

export function useClosetItems(closetId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.closetItems(closetId),
    queryFn: () => getClosetItems(closetId),
    enabled: enabled && !!closetId,
  });
}

// Batch fetch closets with item counts - eliminates N+1 queries
export function useClosetsBatch(clientIds: string[]) {
  const userId = getCurrentUser()?.id ?? '';
  return useQuery({
    queryKey: queryKeys.closetBatch(userId, clientIds),
    queryFn: async () => {
      if (clientIds.length === 0) return [];
      const response = await api.post('/closets/batch', { clientIds });
      return response.data;
    },
    enabled: clientIds.length > 0 && !!userId,
  });
}

// Batch fetch closets with full items
export function useClosetsWithItems(clientIds: string[]) {
  const userId = getCurrentUser()?.id ?? '';
  return useQuery({
    queryKey: ['closetsWithItems', userId, ...clientIds],
    queryFn: async () => {
      if (clientIds.length === 0) return [];
      const response = await api.post('/closets/batch-with-items', { clientIds });
      return response.data;
    },
    enabled: clientIds.length > 0 && !!userId,
  });
}

export function useCreateCloset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ownerId, name }: { ownerId: string; name: string }) => createCloset(ownerId, name),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.closetsByOwner(variables.ownerId) });
      queryClient.invalidateQueries({ queryKey: ['closetBatch'] });
    },
  });
}

export function useAddClosetItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ closetId, item }: { closetId: string; item: Omit<ClosetItem, 'id' | 'closetId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'> }) => 
      addClosetItem(closetId, item),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.closetItems(variables.closetId) });
      queryClient.invalidateQueries({ queryKey: ['closetBatch'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.allClosetItems });
    },
  });
}

export function useUpdateClosetItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ClosetItem> }) => 
      updateClosetItem(id, updates),
    onSuccess: () => {
      // Invalidate all closet items queries since we don't know which closet
      queryClient.invalidateQueries({ queryKey: ['closetItems'] });
      queryClient.invalidateQueries({ queryKey: ['closetBatch'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.allClosetItems });
    },
  });
}

export function useDeleteClosetItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteClosetItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closetItems'] });
      queryClient.invalidateQueries({ queryKey: ['closetBatch'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.allClosetItems });
    },
  });
}

// ==================== LOOKS ====================

export function useLooks() {
  return useQuery({
    queryKey: queryKeys.looks,
    queryFn: getStylistLooks,
  });
}

// Get all looks with their items in a single request - eliminates N+1 queries
export function useLooksWithItems() {
  return useQuery({
    queryKey: queryKeys.looksWithItems,
    queryFn: async () => {
      const response = await api.get('/looks/with-items');
      return response.data;
    },
  });
}

// Get all closet items for look creation
export function useAllClosetItemsForLooks() {
  return useQuery({
    queryKey: queryKeys.allClosetItems,
    queryFn: async () => {
      const response = await api.get('/looks/all-closet-items');
      return response.data;
    },
  });
}

export function useCreateLook() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (lookData: Omit<Look, 'id' | 'stylistId' | 'createdAt' | 'updatedAt'>) => 
      createLook(lookData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.looks });
      queryClient.invalidateQueries({ queryKey: queryKeys.looksWithItems });
      queryClient.invalidateQueries({ queryKey: queryKeys.chatRooms });
    },
  });
}

export function useUpdateLook() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Look> }) => 
      updateLook(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.looks });
      queryClient.invalidateQueries({ queryKey: queryKeys.looksWithItems });
      queryClient.invalidateQueries({ queryKey: queryKeys.chatRooms });
    },
  });
}

export function useDeleteLook() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteLook(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.looks });
      queryClient.invalidateQueries({ queryKey: queryKeys.looksWithItems });
      queryClient.invalidateQueries({ queryKey: queryKeys.chatRooms });
    },
  });
}

// ==================== MESSAGES ====================

export function useChatRooms() {
  return useQuery({
    queryKey: queryKeys.chatRooms,
    queryFn: getChatRooms,
    // Messages need more frequent updates
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useChatRoomMessages(chatRoomId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.chatRoomMessages(chatRoomId),
    queryFn: () => getChatRoomMessages(chatRoomId),
    enabled: enabled && !!chatRoomId,
    // Messages need more frequent updates
    staleTime: 10 * 1000, // 10 seconds
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ chatRoomId, message }: { chatRoomId: string; message: string }) => 
      sendMessage(chatRoomId, message),
    onSuccess: (_, variables) => {
      // Invalidate only the specific chat room messages
      queryClient.invalidateQueries({ queryKey: queryKeys.chatRoomMessages(variables.chatRoomId) });
      // Also update chat rooms for last message
      queryClient.invalidateQueries({ queryKey: queryKeys.chatRooms });
    },
  });
}

export function useMarkMessagesRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (chatRoomId: string) => markChatRoomAsRead(chatRoomId),
    onSuccess: (_, chatRoomId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chatRoomMessages(chatRoomId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.chatRooms });
    },
  });
}

// ==================== LOOK REQUESTS ====================

export function useLookRequests() {
  const userId = getCurrentUser()?.id ?? '';
  return useQuery({
    queryKey: queryKeys.lookRequests,
    queryFn: async () => {
      const res = await api.get<{ data: any[] }>('/look-requests');
      return res.data ?? [];
    },
    enabled: !!userId,
    staleTime: 15 * 1000, // 15 seconds
    // Client: poll every 5s so status updates (e.g. Accept) appear without refresh
    refetchInterval: getCurrentUser()?.userType === 'client' ? 5000 : false,
  });
}

// ==================== UTILITIES ====================

// Hook to manually refresh specific data
export function useRefresh() {
  const queryClient = useQueryClient();
  const userId = getCurrentUser()?.id ?? '';
  
  return {
    /** Refetch clients so UI updates without page refresh. Returns promise so callers can await. */
    refreshClients: () => queryClient.refetchQueries({ queryKey: queryKeys.clients }),
    /** Clear clients cache to [] then refetch (e.g. after delete all). */
    clearClientsAndRefetch: async () => {
      queryClient.setQueryData(queryKeys.clients, []);
      await queryClient.refetchQueries({ queryKey: queryKeys.clients });
    },
    refreshCloset: (clientId: string) => queryClient.invalidateQueries({ queryKey: queryKeys.closet(userId, clientId) }),
    refreshClosetsByOwner: (ownerId: string) => queryClient.invalidateQueries({ queryKey: queryKeys.closetsByOwner(ownerId) }),
    refreshClosetItems: (closetId: string) => queryClient.invalidateQueries({ queryKey: queryKeys.closetItems(closetId) }),
    /** Refetch looks and looksWithItems immediately so UI updates without page refresh. */
    refreshLooks: async () => {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: queryKeys.looks }),
        queryClient.refetchQueries({ queryKey: queryKeys.looksWithItems }),
      ]);
    },
    refreshChatRooms: () => queryClient.refetchQueries({ queryKey: queryKeys.chatRooms }),
    refreshMessages: (chatRoomId: string) => queryClient.invalidateQueries({ queryKey: queryKeys.chatRoomMessages(chatRoomId) }),
    refreshLookRequests: () => queryClient.refetchQueries({ queryKey: queryKeys.lookRequests }),
    refreshAll: () => queryClient.invalidateQueries(),
  };
}
