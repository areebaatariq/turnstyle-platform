import { User } from '@/types';
import { authApi, setAuthToken as setApiToken, removeAuthToken } from './api';
import { queryClient } from '@/App';

const CURRENT_USER_KEY = 'turnstyle_current_user';

/**
 * Authenticate with Google OAuth using ID token
 */
export async function loginWithGoogle(idToken: string): Promise<User> {
  try {
    console.log('Calling backend to verify Google token...');
    const response = await authApi.verifyGoogleToken(idToken);
    console.log('Backend response:', response);
    
    // Store JWT token
    setApiToken(response.token);
    
    // Convert API user to app User type
    const user: User = {
      id: response.user.id,
      email: response.user.email,
      name: response.user.name,
      userType: response.user.userType as 'stylist' | 'client',
      profilePhotoUrl: response.user.profilePhotoUrl,
      oauthProvider: response.user.oauthProvider,
      createdAt: new Date().toISOString(),
    };
    
    // Store user in localStorage
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    
    return user;
  } catch (error: any) {
    console.error('Error in loginWithGoogle:', error);
    throw new Error(error.message || 'Failed to authenticate with Google');
  }
}

/**
 * Authenticate with Apple OAuth using ID token
 */
export async function loginWithApple(idToken: string): Promise<User> {
  try {
    const response = await authApi.verifyAppleToken(idToken);
    
    // Store JWT token
    setApiToken(response.token);
    
    // Convert API user to app User type
    const user: User = {
      id: response.user.id,
      email: response.user.email,
      name: response.user.name,
      userType: response.user.userType as 'stylist' | 'client',
      profilePhotoUrl: response.user.profilePhotoUrl,
      oauthProvider: response.user.oauthProvider,
      createdAt: new Date().toISOString(),
    };
    
    // Store user in localStorage
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    
    return user;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to authenticate with Apple');
  }
}

/**
 * Get current user from localStorage
 */
export function getCurrentUser(): User | null {
  const userStr = localStorage.getItem(CURRENT_USER_KEY);
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Update current user in localStorage
 */
export function updateCurrentUser(updates: Partial<User>): User | null {
  const currentUser = getCurrentUser();
  if (!currentUser) return null;
  
  const updatedUser = { ...currentUser, ...updates };
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
  
  return updatedUser;
}

/**
 * Logout user - clears all user data and cache
 */
export function logout(): void {
  // Clear user from localStorage
  localStorage.removeItem(CURRENT_USER_KEY);
  
  // Remove auth token
  removeAuthToken();
  
  // Clear React Query cache to prevent data leaks between accounts
  // This ensures the next user doesn't see previous user's data
  queryClient.clear();
}
