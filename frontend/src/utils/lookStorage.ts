import { Look, LookItem, LookStatus, Client, ClosetItem } from '@/types';
import { getCurrentUser } from './mockAuth';
import { apiRequest, ApiResponse } from './api';

// Looks API
export const getLooks = async (clientId?: string): Promise<Look[]> => {
  try {
    const queryParams = clientId ? `?clientId=${clientId}` : '';
    const response = await apiRequest<ApiResponse<Look[]>>(`/looks${queryParams}`);
    return response.data || [];
  } catch (error) {
    console.error('Error fetching looks:', error);
    return [];
  }
};

export const getStylistLooks = async (): Promise<Look[]> => {
  try {
    const response = await apiRequest<ApiResponse<Look[]>>('/looks');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching stylist looks:', error);
    return [];
  }
};

export const getClientLooks = async (clientId: string): Promise<Look[]> => {
  try {
    const response = await apiRequest<ApiResponse<Look[]>>(`/looks?clientId=${clientId}`);
    return response.data || [];
  } catch (error) {
    console.error('Error fetching client looks:', error);
    return [];
  }
};

export const getLookById = async (lookId: string): Promise<Look | null> => {
  try {
    const response = await apiRequest<ApiResponse<Look>>(`/looks/${lookId}`);
    return response.data || null;
  } catch (error) {
    console.error('Error fetching look:', error);
    return null;
  }
};

/** Look item with resolved closet item (from correct closet for both stylist and client) */
export interface LookItemWithClosetItem extends LookItem {
  closetItem: ClosetItem | null;
  newItemDetails?: any;
}

export const getLookWithItems = async (
  lookId: string
): Promise<{ look: Look; client: Client | null; items: LookItemWithClosetItem[] } | null> => {
  try {
    const response = await apiRequest<
      ApiResponse<{ look: Look; client: Client | null; items: LookItemWithClosetItem[] }>
    >(`/looks/${lookId}/with-items`);
    return response.data || null;
  } catch (error) {
    console.error('Error fetching look with items:', error);
    return null;
  }
};

export const createLook = async (
  lookData: Omit<Look, 'id' | 'stylistId' | 'createdAt' | 'updatedAt'>
): Promise<Look> => {
  try {
    const response = await apiRequest<ApiResponse<Look>>('/looks', {
      method: 'POST',
      body: JSON.stringify(lookData),
    });
    if (!response.data) {
      throw new Error('Failed to create look');
    }
    return response.data;
  } catch (error) {
    console.error('Error creating look:', error);
    throw error;
  }
};

export const updateLook = async (lookId: string, updates: Partial<Look>): Promise<Look | null> => {
  try {
    const response = await apiRequest<ApiResponse<Look>>(`/looks/${lookId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.data || null;
  } catch (error) {
    console.error('Error updating look:', error);
    return null;
  }
};

export const deleteLook = async (lookId: string): Promise<boolean> => {
  console.log('🗑️ deleteLook API call for lookId:', lookId);
  try {
    const response = await apiRequest<ApiResponse<{ success: boolean }>>(`/looks/${lookId}`, {
      method: 'DELETE',
    });
    console.log('🗑️ deleteLook API response:', response);
    return true;
  } catch (error) {
    console.error('🗑️ Error deleting look:', error);
    return false;
  }
};

export const updateLookStatus = async (lookId: string, status: LookStatus): Promise<Look | null> => {
  return updateLook(lookId, { status });
};

export const getLooksByStatus = async (status: LookStatus): Promise<Look[]> => {
  const looks = await getStylistLooks();
  return looks.filter(look => look.status === status);
};

// LookItems API
export const getLookItems = async (lookId?: string): Promise<LookItem[]> => {
  try {
    const queryParams = lookId ? `?lookId=${lookId}` : '';
    const response = await apiRequest<ApiResponse<LookItem[]>>(`/look-items${queryParams}`);
    return response.data || [];
  } catch (error) {
    console.error('Error fetching look items:', error);
    return [];
  }
};

export const getLookItemsByLookId = async (lookId: string): Promise<LookItem[]> => {
  return getLookItems(lookId);
};

export const addItemToLook = async (
  lookId: string,
  itemId: string,
  itemType: 'closet_item' | 'new_purchase' = 'closet_item'
): Promise<LookItem> => {
  try {
    // Get existing items to determine sort order
    const existingItems = await getLookItems(lookId);
    
    const response = await apiRequest<ApiResponse<LookItem>>('/look-items', {
      method: 'POST',
      body: JSON.stringify({
        lookId,
        itemId,
        itemType,
        sortOrder: existingItems.length,
      }),
    });
    
    if (!response.data) {
      throw new Error('Failed to create look item');
    }
    
    return response.data;
  } catch (error) {
    console.error('Error adding item to look:', error);
    throw error;
  }
};

export const bulkAddItemsToLook = async (
  lookId: string,
  itemIds: string[],
  itemType: 'closet_item' | 'new_purchase' = 'closet_item',
  positions?: Array<{ positionX?: number; positionY?: number; scale?: number }>
): Promise<LookItem[]> => {
  try {
    // Get existing items to determine sort order
    const existingItems = await getLookItems(lookId);
    let sortOrder = existingItems.length;
    
    const itemsData = itemIds.map((itemId, i) => ({
      lookId,
      itemId,
      itemType,
      sortOrder: sortOrder++,
      ...(positions?.[i] && {
        positionX: positions[i].positionX,
        positionY: positions[i].positionY,
        scale: positions[i].scale,
      }),
    }));
    
    const response = await apiRequest<ApiResponse<LookItem[]>>('/look-items/bulk', {
      method: 'POST',
      body: JSON.stringify({ items: itemsData }),
    });
    
    if (!response.data || response.data.length === 0) {
      throw new Error('Failed to create look items');
    }
    
    return response.data;
  } catch (error) {
    console.error('Error bulk adding items to look:', error);
    throw error;
  }
};

export const updateLookItem = async (lookItemId: string, updates: Partial<LookItem>): Promise<LookItem | null> => {
  try {
    const response = await apiRequest<ApiResponse<LookItem>>(`/look-items/${lookItemId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.data ?? null;
  } catch (error) {
    console.error('Error updating look item:', error);
    return null;
  }
};

export const removeItemFromLook = async (lookItemId: string): Promise<boolean> => {
  try {
    await apiRequest<ApiResponse<{ success: boolean }>>(`/look-items/${lookItemId}`, {
      method: 'DELETE',
    });
    return true;
  } catch (error) {
    console.error('Error removing item from look:', error);
    return false;
  }
};

export const createLookVersion = async (parentLookId: string, changes: Partial<Look>): Promise<Look> => {
  const parentLook = await getLookById(parentLookId);
  if (!parentLook) throw new Error('Parent look not found');
  
  const newLook = await createLook({
    ...parentLook,
    ...changes,
    parentLookId,
    status: 'draft',
  });
  
  // Copy look items from parent
  const parentItems = await getLookItemsByLookId(parentLookId);
  await Promise.all(
    parentItems.map(item => addItemToLook(newLook.id, item.itemId, item.itemType))
  );
  
  return newLook;
};
