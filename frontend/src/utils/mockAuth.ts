import { User } from '@/types';

const CURRENT_USER_KEY = 'turnstyle_current_user';
const USERS_KEY = 'turnstyle_users';

export const mockOAuthLogin = async (provider: 'google' | 'apple'): Promise<User> => {
  // Simulate OAuth flow delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Create mock user
  const mockUser: User = {
    id: `user_${Date.now()}`,
    email: `user@${provider}.com`,
    userType: 'stylist',
    name: provider === 'google' ? 'Google User' : 'Apple User',
    oauthProvider: provider,
    createdAt: new Date().toISOString(),
  };
  
  // Store in localStorage
  const users = getUsers();
  users.push(mockUser);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(mockUser));
  
  return mockUser;
};

export const mockEmailSignup = async (email: string, password: string, name: string): Promise<User> => {
  await new Promise(resolve => setTimeout(resolve, 800));
  
  const mockUser: User = {
    id: `user_${Date.now()}`,
    email,
    userType: 'stylist',
    name,
    createdAt: new Date().toISOString(),
  };
  
  const users = getUsers();
  users.push(mockUser);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(mockUser));
  
  return mockUser;
};

export const mockEmailLogin = async (email: string, password: string): Promise<User | null> => {
  await new Promise(resolve => setTimeout(resolve, 800));
  
  const users = getUsers();
  const user = users.find(u => u.email === email);
  
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    return user;
  }
  
  return null;
};

export const getCurrentUser = (): User | null => {
  const userStr = localStorage.getItem(CURRENT_USER_KEY);
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

export const updateCurrentUser = (updates: Partial<User>): User | null => {
  const currentUser = getCurrentUser();
  if (!currentUser) return null;
  
  const updatedUser = { ...currentUser, ...updates };
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
  
  // Update in users list
  const users = getUsers();
  const index = users.findIndex(u => u.id === currentUser.id);
  if (index !== -1) {
    users[index] = updatedUser;
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
  
  return updatedUser;
};

export const logout = () => {
  localStorage.removeItem(CURRENT_USER_KEY);
};

const getUsers = (): User[] => {
  const usersStr = localStorage.getItem(USERS_KEY);
  if (!usersStr) return [];
  
  try {
    return JSON.parse(usersStr);
  } catch {
    return [];
  }
};