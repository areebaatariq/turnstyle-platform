import { Client, Relationship } from '@/types';
import { apiRequest, ApiResponse } from './api';

// Clients API
export const getStylistClients = async (): Promise<Client[]> => {
  try {
    const response = await apiRequest<ApiResponse<Client[]>>('/clients');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching clients:', error);
    throw error;
  }
};

export const getMyClient = async (): Promise<Client | null> => {
  try {
    const response = await apiRequest<ApiResponse<Client>>('/clients/me');
    return response.data || null;
  } catch (error) {
    console.error('Error fetching my client:', error);
    return null;
  }
};

export const getClientById = async (id: string): Promise<Client | null> => {
  try {
    const response = await apiRequest<ApiResponse<Client>>(`/clients/${id}`);
    return response.data || null;
  } catch (error) {
    console.error('Error fetching client:', error);
    return null;
  }
};

export const addClient = async (clientData: Omit<Client, 'id' | 'relationshipId' | 'relationshipStatus'>): Promise<Client> => {
  try {
    const response = await apiRequest<ApiResponse<Client>>('/clients', {
      method: 'POST',
      body: JSON.stringify(clientData),
    });
    if (!response.data) {
      throw new Error('Failed to create client');
    }
    return response.data;
  } catch (error) {
    console.error('Error creating client:', error);
    throw error;
  }
};

export const updateClient = async (clientId: string, updates: Partial<Client>): Promise<Client | null> => {
  try {
    const response = await apiRequest<ApiResponse<Client>>(`/clients/${clientId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.data || null;
  } catch (error) {
    console.error('Error updating client:', error);
    return null;
  }
};

export const deleteClient = async (clientId: string): Promise<boolean> => {
  try {
    await apiRequest<ApiResponse<{ success: boolean }>>(`/clients/${clientId}`, {
      method: 'DELETE',
    });
    return true;
  } catch (error) {
    console.error('Error deleting client:', error);
    return false;
  }
};

export const deleteAllClients = async (): Promise<{ deletedCount: number; totalClients: number }> => {
  try {
    const response = await apiRequest<ApiResponse<{ success: boolean; deletedCount: number; totalClients: number; errors?: string[] }>>('/clients', {
      method: 'DELETE',
    });
    if (response.data) {
      return {
        deletedCount: response.data.deletedCount || 0,
        totalClients: response.data.totalClients || 0,
      };
    }
    throw new Error('Failed to delete all clients');
  } catch (error: any) {
    console.error('Error deleting all clients:', error);
    throw error;
  }
};

export const bulkImportClients = async (clientsData: Omit<Client, 'id' | 'relationshipId' | 'relationshipStatus'>[]): Promise<Client[] | any> => {
  try {
    const response = await apiRequest<ApiResponse<Client[] | { data: Client[]; message?: string; skipped?: number }>>('/clients/bulk', {
      method: 'POST',
      body: JSON.stringify({ clients: clientsData }),
    });
    // Backend may return response with metadata or just data array
    if (response.data && Array.isArray(response.data)) {
      return response.data;
    }
    return response; // Return full response if it has metadata
  } catch (error) {
    console.error('Error bulk importing clients:', error);
    throw error;
  }
};

// Relationships API
export const getRelationships = async (): Promise<Relationship[]> => {
  try {
    const response = await apiRequest<ApiResponse<Relationship[]>>('/relationships');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching relationships:', error);
    return [];
  }
};

export const createRelationship = async (
  clientId: string,
  status: 'invited' | 'active' = 'invited'
): Promise<Relationship> => {
  try {
    const response = await apiRequest<ApiResponse<Relationship>>('/relationships', {
      method: 'POST',
      body: JSON.stringify({ clientId, status }),
    });
    if (!response.data) {
      throw new Error('Failed to create relationship');
    }
    return response.data;
  } catch (error) {
    console.error('Error creating relationship:', error);
    throw error;
  }
};

export const updateRelationshipStatus = async (
  relationshipId: string,
  status: 'invited' | 'active' | 'ended'
): Promise<Relationship | null> => {
  try {
    const response = await apiRequest<ApiResponse<Relationship>>(`/relationships/${relationshipId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return response.data || null;
  } catch (error) {
    console.error('Error updating relationship:', error);
    return null;
  }
};

// Legacy sync functions for backward compatibility (now call async versions)
// These can be removed once all components are updated to use async versions
export const getClients = (): Client[] => {
  console.warn('getClients() is deprecated, use getStylistClients() instead');
  return [];
};
