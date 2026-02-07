import { User } from '@/types';
import { apiRequest, ApiResponse } from './api';

export const getCurrentUserProfile = async (): Promise<User | null> => {
  try {
    const response = await apiRequest<ApiResponse<Omit<User, 'password'>>>('/users/me');
    return response.data as User || null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
};

export const updateUserProfile = async (
  updates: Partial<Pick<User, 'name' | 'bio' | 'location' | 'profilePhotoUrl' | 'phone'>>
): Promise<User | null> => {
  try {
    const response = await apiRequest<ApiResponse<Omit<User, 'password'>>>('/users/me', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.data as User || null;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};
