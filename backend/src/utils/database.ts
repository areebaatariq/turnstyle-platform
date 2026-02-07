import { User, CreateUserDto } from '../types/user';
import fs from 'fs/promises';
import path from 'path';
import { cache, CACHE_KEYS, CACHE_PREFIXES } from './cache';

const DB_FILE = path.join(process.cwd(), 'data', 'users.json');

// Ensure data directory exists
async function ensureDataDirectory() {
  const dataDir = path.dirname(DB_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Read users from file
export async function getUsers(): Promise<User[]> {
  // Check cache first
  const cached = cache.get<User[]>(CACHE_KEYS.USERS);
  if (cached) {
    return cached;
  }
  
  try {
    await ensureDataDirectory();
    const data = await fs.readFile(DB_FILE, 'utf-8');
    const users = JSON.parse(data);
    cache.set(CACHE_KEYS.USERS, users);
    return users;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

// Write users to file
async function writeUsers(users: User[]): Promise<void> {
  await ensureDataDirectory();
  await fs.writeFile(DB_FILE, JSON.stringify(users, null, 2));
  // Invalidate user-related caches
  cache.invalidateByPrefix(CACHE_PREFIXES.USERS);
}

// Find user by ID
export async function findUserById(id: string): Promise<User | null> {
  // Check specific cache first
  const cacheKey = CACHE_KEYS.USER_BY_ID(id);
  const cached = cache.get<User>(cacheKey);
  if (cached) {
    return cached;
  }
  
  const users = await getUsers();
  const user = users.find(u => u.id === id) || null;
  if (user) {
    cache.set(cacheKey, user);
  }
  return user;
}

// Find user by email
export async function findUserByEmail(email: string): Promise<User | null> {
  // Check specific cache first
  const cacheKey = CACHE_KEYS.USER_BY_EMAIL(email);
  const cached = cache.get<User>(cacheKey);
  if (cached) {
    return cached;
  }
  
  const users = await getUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  if (user) {
    cache.set(cacheKey, user);
  }
  return user;
}

// Find user by OAuth provider and ID
export async function findUserByOAuth(
  provider: 'google' | 'apple',
  oauthId: string
): Promise<User | null> {
  const users = await getUsers();
  return users.find(
    u => u.oauthProvider === provider && u.oauthId === oauthId
  ) || null;
}

// Create new user
export async function createUser(userData: CreateUserDto): Promise<User> {
  const users = await getUsers();
  
  // Check if user already exists by email
  const existingUser = await findUserByEmail(userData.email);
  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  // Check if OAuth user already exists
  if (userData.oauthProvider && userData.oauthId) {
    const existingOAuthUser = await findUserByOAuth(
      userData.oauthProvider,
      userData.oauthId
    );
    if (existingOAuthUser) {
      throw new Error(`User with this ${userData.oauthProvider} account already exists`);
    }
  }

  const newUser: User = {
    id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...userData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  users.push(newUser);
  await writeUsers(users);
  
  return newUser;
}

// Update user
export async function updateUser(
  id: string,
  updates: Partial<User>
): Promise<User | null> {
  const users = await getUsers();
  const userIndex = users.findIndex(u => u.id === id);
  
  if (userIndex === -1) {
    return null;
  }

  users[userIndex] = {
    ...users[userIndex],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await writeUsers(users);
  return users[userIndex];
}
