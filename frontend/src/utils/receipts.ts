import { Receipt } from '@/types';
import { apiRequest, ApiResponse } from './api';

export const getReceipts = async (clientId?: string): Promise<Receipt[]> => {
  try {
    const queryParams = clientId ? `?clientId=${clientId}` : '';
    const response = await apiRequest<ApiResponse<Receipt[]>>(`/receipts${queryParams}`);
    return response.data || [];
  } catch (error) {
    console.error('Error fetching receipts:', error);
    return [];
  }
};

export const getReceiptById = async (id: string): Promise<Receipt | null> => {
  try {
    const response = await apiRequest<ApiResponse<Receipt>>(`/receipts/${id}`);
    return response.data || null;
  } catch (error) {
    console.error('Error fetching receipt:', error);
    return null;
  }
};

export const createReceipt = async (receiptData: Omit<Receipt, 'id' | 'stylistId' | 'createdAt'>): Promise<Receipt> => {
  try {
    const response = await apiRequest<ApiResponse<Receipt>>('/receipts', {
      method: 'POST',
      body: JSON.stringify(receiptData),
    });
    if (!response.data) {
      throw new Error('Failed to create receipt');
    }
    return response.data;
  } catch (error) {
    console.error('Error creating receipt:', error);
    throw error;
  }
};

export const updateReceipt = async (id: string, updates: Partial<Receipt>): Promise<Receipt | null> => {
  try {
    const response = await apiRequest<ApiResponse<Receipt>>(`/receipts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.data || null;
  } catch (error) {
    console.error('Error updating receipt:', error);
    return null;
  }
};

export const deleteReceipt = async (id: string): Promise<boolean> => {
  try {
    await apiRequest<ApiResponse<{ success: boolean }>>(`/receipts/${id}`, {
      method: 'DELETE',
    });
    return true;
  } catch (error) {
    console.error('Error deleting receipt:', error);
    return false;
  }
};
