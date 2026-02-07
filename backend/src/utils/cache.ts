/**
 * Simple in-memory cache with TTL support
 * Provides significant performance improvement by reducing file system reads
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL: number;

  constructor(defaultTTLSeconds: number = 60) {
    this.defaultTTL = defaultTTLSeconds * 1000;
    
    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Get a value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  /**
   * Set a value in cache
   */
  set<T>(key: string, data: T, ttlSeconds?: number): void {
    const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTTL;
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Delete a specific key
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all keys matching a prefix
   */
  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// Cache keys constants
export const CACHE_KEYS = {
  USERS: 'users:all',
  USER_BY_ID: (id: string) => `users:id:${id}`,
  USER_BY_EMAIL: (email: string) => `users:email:${email.toLowerCase()}`,
  
  CLIENTS: 'clients:all',
  CLIENT_BY_ID: (id: string) => `clients:id:${id}`,
  CLIENT_BY_EMAIL: (email: string) => `clients:email:${email.toLowerCase()}`,
  
  RELATIONSHIPS: 'relationships:all',
  RELATIONSHIPS_BY_STYLIST: (stylistId: string) => `relationships:stylist:${stylistId}`,
  
  CLOSETS: 'closets:all',
  CLOSET_BY_ID: (id: string) => `closets:id:${id}`,
  CLOSET_BY_OWNER: (ownerId: string) => `closets:owner:${ownerId}`,
  CLOSET_BY_STYLIST_OWNER: (stylistId: string | null, ownerId: string) =>
    `closets:stylist:${stylistId ?? 'client'}:owner:${ownerId}`,
  
  CLOSET_ITEMS: 'closet_items:all',
  CLOSET_ITEMS_BY_CLOSET: (closetId: string) => `closet_items:closet:${closetId}`,
  
  SUBCATEGORIES: 'subcategories:all',
  SUBCATEGORIES_BY_STYLIST_CATEGORY: (stylistId: string, category: string) =>
    `subcategories:stylist:${stylistId}:category:${category}`,
  
  LOOKS: 'looks:all',
  LOOKS_BY_STYLIST: (stylistId: string) => `looks:stylist:${stylistId}`,
  LOOK_BY_ID: (id: string) => `looks:id:${id}`,
  
  LOOK_ITEMS: 'look_items:all',
  LOOK_ITEMS_BY_LOOK: (lookId: string) => `look_items:look:${lookId}`,
  
  CHAT_ROOMS: 'chat_rooms:all',
  CHAT_ROOMS_BY_USER: (userId: string) => `chat_rooms:user:${userId}`,
  CHAT_ROOM_BY_ID: (id: string) => `chat_rooms:id:${id}`,
  CHAT_ROOM_BY_LOOK: (lookId: string) => `chat_rooms:look:${lookId}`,
  
  MESSAGES_BY_CHAT_ROOM: (chatRoomId: string) => `messages:chatroom:${chatRoomId}`,
};

// Cache invalidation helpers
export const CACHE_PREFIXES = {
  USERS: 'users:',
  CLIENTS: 'clients:',
  RELATIONSHIPS: 'relationships:',
  CLOSETS: 'closets:',
  CLOSET_ITEMS: 'closet_items:',
  SUBCATEGORIES: 'subcategories:',
  LOOKS: 'looks:',
  LOOK_ITEMS: 'look_items:',
  CHAT_ROOMS: 'chat_rooms:',
  MESSAGES: 'messages:',
};

// Singleton cache instance with 2-minute default TTL
export const cache = new MemoryCache(120);

// Export type for use in other files
export type { MemoryCache };
