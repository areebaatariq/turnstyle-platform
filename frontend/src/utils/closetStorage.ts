import { Closet, ClosetItem, ItemCategory } from '@/types';
import { getCurrentUser } from './mockAuth';
import { apiRequest, ApiResponse } from './api';

// Subcategory type (matches backend)
export interface Subcategory {
  id: string;
  stylistId: string;
  category: ItemCategory;
  name: string;
  createdAt: string;
}

// Subcategories API (stylist only)
export const getSubcategories = async (category: ItemCategory): Promise<Subcategory[]> => {
  try {
    const response = await apiRequest<ApiResponse<Subcategory[]>>(
      `/subcategories?category=${encodeURIComponent(category)}`
    );
    return response.data ?? [];
  } catch (error) {
    console.error('Error fetching subcategories:', error);
    return [];
  }
};

export const createSubcategory = async (
  category: ItemCategory,
  name: string
): Promise<Subcategory | null> => {
  try {
    const response = await apiRequest<ApiResponse<Subcategory>>('/subcategories', {
      method: 'POST',
      body: JSON.stringify({ category, name: name.trim() }),
    });
    return response.data ?? null;
  } catch (error) {
    console.error('Error creating subcategory:', error);
    throw error;
  }
};

export const deleteSubcategory = async (id: string): Promise<boolean> => {
  try {
    await apiRequest<ApiResponse<{ success: boolean }>>(`/subcategories/${id}`, {
      method: 'DELETE',
    });
    return true;
  } catch (error) {
    console.error('Error deleting subcategory:', error);
    return false;
  }
};

// Closets API
export const getClosets = async (): Promise<Closet[]> => {
  try {
    const response = await apiRequest<ApiResponse<Closet[]>>('/closets');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching closets:', error);
    return [];
  }
};

export const getOrCreateCloset = async (clientId: string): Promise<Closet> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) throw new Error('Not authenticated');
    
    const response = await apiRequest<ApiResponse<Closet>>(`/closets/owner/${clientId}`);
    if (!response.data) {
      throw new Error('Failed to get or create closet');
    }
    return response.data;
  } catch (error) {
    console.error('Error getting or creating closet:', error);
    throw error;
  }
};

/**
 * Get all closets for a client (owner). Used for Client → Closets list screen.
 */
export const getClosetsByOwner = async (ownerId: string): Promise<Closet[]> => {
  try {
    const response = await apiRequest<ApiResponse<Closet[]>>(`/closets/by-owner/${ownerId}`);
    return response.data ?? [];
  } catch (error) {
    console.error('Error fetching closets by owner:', error);
    return [];
  }
};

/**
 * Create a new closet for a client. Name is required and must be unique per client.
 */
export const createCloset = async (ownerId: string, name: string): Promise<Closet> => {
  const trimmed = (name ?? '').trim();
  if (!trimmed) throw new Error('Closet name is required');
  const response = await apiRequest<ApiResponse<Closet>>('/closets', {
    method: 'POST',
    body: JSON.stringify({ ownerId, name: trimmed }),
  });
  if (!response.data) throw new Error('Failed to create closet');
  return response.data;
};

/**
 * Get the client's own closet (stylist-only). Use when editing a look so that
 * look itemIds, which reference the client's closet, resolve correctly.
 * Returns null on any error (e.g. 404) so caller can fall back to getOrCreateCloset.
 */
export const getClientCloset = async (clientId: string): Promise<Closet | null> => {
  try {
    const response = await apiRequest<ApiResponse<Closet>>(`/closets/client/${clientId}`);
    return response.data ?? null;
  } catch (error: any) {
    // 404 or other errors: return null so edit flow can use getOrCreateCloset (stylist's closet for this client)
    console.warn('getClientCloset failed, will fall back to owner closet:', error?.message || error);
    return null;
  }
};

// Closet Items API
export const getClosetItems = async (closetId?: string): Promise<ClosetItem[]> => {
  try {
    const queryParams = closetId ? `?closetId=${closetId}` : '';
    const response = await apiRequest<ApiResponse<ClosetItem[]>>(`/closet-items${queryParams}`);
    return response.data || [];
  } catch (error) {
    console.error('Error fetching closet items:', error);
    return [];
  }
};

export const getClosetItemById = async (itemId: string): Promise<ClosetItem | null> => {
  try {
    const response = await apiRequest<ApiResponse<ClosetItem>>(`/closet-items/${itemId}`);
    return response.data || null;
  } catch (error) {
    console.error('Error fetching closet item:', error);
    return null;
  }
};

export const addClosetItem = async (
  itemData: Omit<ClosetItem, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'archived'>
): Promise<ClosetItem> => {
  try {
    const response = await apiRequest<ApiResponse<ClosetItem>>('/closet-items', {
      method: 'POST',
      body: JSON.stringify(itemData),
    });
    if (!response.data) {
      throw new Error('Failed to create closet item');
    }
    return response.data;
  } catch (error) {
    console.error('Error creating closet item:', error);
    throw error;
  }
};

export const updateClosetItem = async (
  itemId: string,
  updates: Partial<ClosetItem>
): Promise<ClosetItem | null> => {
  try {
    const response = await apiRequest<ApiResponse<ClosetItem>>(`/closet-items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.data || null;
  } catch (error) {
    console.error('Error updating closet item:', error);
    return null;
  }
};

export const deleteClosetItem = async (itemId: string): Promise<boolean> => {
  try {
    await apiRequest<ApiResponse<{ success: boolean }>>(`/closet-items/${itemId}`, {
      method: 'DELETE',
    });
    return true;
  } catch (error) {
    console.error('Error deleting closet item:', error);
    return false;
  }
};

const BULK_CHUNK_SIZE = 25;

export const bulkAddClosetItems = async (
  itemsData: Omit<ClosetItem, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'archived'>[]
): Promise<ClosetItem[]> => {
  try {
    if (itemsData.length === 0) return [];
    const allCreated: ClosetItem[] = [];
    for (let i = 0; i < itemsData.length; i += BULK_CHUNK_SIZE) {
      const chunk = itemsData.slice(i, i + BULK_CHUNK_SIZE);
      const response = await apiRequest<ApiResponse<ClosetItem[]>>('/closet-items/bulk', {
        method: 'POST',
        body: JSON.stringify({ items: chunk }),
      });
      const created = response.data || [];
      allCreated.push(...created);
    }
    return allCreated;
  } catch (error) {
    console.error('Error bulk adding closet items:', error);
    throw error;
  }
};

export const searchClosetItems = async (
  closetId: string,
  query: string,
  category?: ItemCategory
): Promise<ClosetItem[]> => {
  try {
    const params = new URLSearchParams({ closetId });
    if (query) params.append('search', query);
    if (category) params.append('category', category);
    
    const response = await apiRequest<ApiResponse<ClosetItem[]>>(`/closet-items?${params.toString()}`);
    return response.data || [];
  } catch (error) {
    console.error('Error searching closet items:', error);
    return [];
  }
};
