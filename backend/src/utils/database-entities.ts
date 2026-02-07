import fs from 'fs/promises';
import path from 'path';
import {
  Client,
  CreateClientDto,
  Relationship,
  Closet,
  ClosetItem,
  CreateClosetItemDto,
  Look,
  CreateLookDto,
  LookItem,
  LookRequest,
  ChatRoom,
  Message,
  CreateMessageDto,
  Subcategory,
  ItemCategory,
} from '../types';
import { cache, CACHE_KEYS, CACHE_PREFIXES } from './cache';

// Export LookItem type explicitly
export type { LookItem };
export type { ChatRoom };

const DATA_DIR = path.join(process.cwd(), 'data');

// Ensure data directory exists
async function ensureDataDirectory() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

/**
 * Parse JSON from a data file. On "Unexpected non-whitespace character after JSON at position N",
 * tries to parse only the first N characters (valid JSON + trailing garbage in file).
 * Rethrows with filePath in message for easier debugging.
 */
function parseJsonFile<T>(data: string, filePath: string): T {
  try {
    return JSON.parse(data) as T;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw error;
    }
    const positionMatch = error.message?.match(/position (\d+)/);
    if (positionMatch) {
      const pos = parseInt(positionMatch[1], 10);
      try {
        const parsed = JSON.parse(data.substring(0, pos)) as T;
        console.warn(`[database-entities] Recovered valid JSON from ${filePath} by truncating at position ${pos} (trailing garbage ignored).`);
        return parsed;
      } catch {
        // fall through to rethrow with file path
      }
    }
    const fileName = path.basename(filePath);
    throw new Error(`Invalid JSON in ${fileName}: ${error.message}`);
  }
}

// ==================== CLIENTS ====================

const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');

async function readClients(): Promise<Client[]> {
  // Check cache first
  const cached = cache.get<Client[]>(CACHE_KEYS.CLIENTS);
  if (cached) {
    return cached;
  }
  
  try {
    await ensureDataDirectory();
    const data = await fs.readFile(CLIENTS_FILE, 'utf-8');
    const clients = parseJsonFile<Client[]>(data, CLIENTS_FILE);
    cache.set(CACHE_KEYS.CLIENTS, clients);
    return clients;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function writeClients(clients: Client[]): Promise<void> {
  await ensureDataDirectory();
  await fs.writeFile(CLIENTS_FILE, JSON.stringify(clients, null, 2));
  // Invalidate client-related caches
  cache.invalidateByPrefix(CACHE_PREFIXES.CLIENTS);
}

export async function getAllClients(): Promise<Client[]> {
  return readClients();
}

export async function getClientById(id: string): Promise<Client | null> {
  // Check specific cache first
  const cacheKey = CACHE_KEYS.CLIENT_BY_ID(id);
  const cached = cache.get<Client>(cacheKey);
  if (cached) {
    return cached;
  }
  
  const clients = await readClients();
  const client = clients.find(c => c.id === id) || null;
  if (client) {
    cache.set(cacheKey, client);
  }
  return client;
}

export async function getClientByEmail(email: string): Promise<Client | null> {
  // Check specific cache first
  const cacheKey = CACHE_KEYS.CLIENT_BY_EMAIL(email);
  const cached = cache.get<Client>(cacheKey);
  if (cached) {
    return cached;
  }
  
  const clients = await readClients();
  const client = clients.find(c => c.email.toLowerCase() === email.toLowerCase()) || null;
  if (client) {
    cache.set(cacheKey, client);
  }
  return client;
}

export async function createClient(clientData: CreateClientDto): Promise<Client> {
  const clients = await readClients();
  
  // Normalize email to lowercase for consistency
  const normalizedEmail = clientData.email.toLowerCase().trim();
  
  // Check if client already exists by email (case-insensitive)
  const existing = await getClientByEmail(normalizedEmail);
  if (existing) {
    throw new Error('Client with this email already exists');
  }

  const newClient: Client = {
    id: `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...clientData,
    email: normalizedEmail, // Ensure email is normalized
  };

  clients.push(newClient);
  await writeClients(clients);
  
  return newClient;
}

export async function updateClient(id: string, updates: Partial<Client>): Promise<Client | null> {
  const clients = await readClients();
  const index = clients.findIndex(c => c.id === id);
  
  if (index === -1) {
    return null;
  }

  clients[index] = { ...clients[index], ...updates };
  await writeClients(clients);
  
  return clients[index];
}

export async function deleteClient(id: string): Promise<boolean> {
  const clients = await readClients();
  const exists = clients.some(c => c.id === id);
  if (!exists) return false;

  // Cascade: delete looks (and look items, chat rooms, messages), closet (and closet items)
  const looks = await readLooks();
  const clientLooks = looks.filter(l => l.clientId === id);
  for (const look of clientLooks) {
    const chatRoom = await getChatRoomByLookId(look.id);
    if (chatRoom) {
      await deleteMessagesByChatRoomId(chatRoom.id);
      await deleteChatRoom(chatRoom.id);
    }
    await deleteLookItemsByLookId(look.id);
  }
  const looksToKeep = looks.filter(l => l.clientId !== id);
  await writeLooks(looksToKeep);

  const closets = await getClosetsByOwnerId(id);
  for (const closet of closets) {
    await deleteClosetItemsByClosetId(closet.id);
    await deleteCloset(closet.id);
  }

  const filtered = clients.filter(c => c.id !== id);
  await writeClients(filtered);
  return true;
}

export async function bulkCreateClients(clientsData: CreateClientDto[]): Promise<Client[]> {
  const clients = await readClients();
  const newClients: Client[] = [];
  const existingEmails = new Set(clients.map(c => c.email.toLowerCase()));

  for (const data of clientsData) {
    // Check if client already exists by email (case-insensitive)
    const emailLower = data.email.toLowerCase();
    if (existingEmails.has(emailLower)) {
      // Skip duplicate - client already exists
      continue;
    }

    // Check for duplicates within the same batch
    const alreadyInBatch = newClients.some(nc => nc.email.toLowerCase() === emailLower);
    if (alreadyInBatch) {
      // Skip duplicate within batch
      continue;
    }

    const newClient: Client = {
      id: `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...data,
      email: emailLower, // Normalize email to lowercase
    };

    newClients.push(newClient);
    existingEmails.add(emailLower); // Track for batch duplicate checking
  }

  if (newClients.length > 0) {
    clients.push(...newClients);
    await writeClients(clients);
  }
  
  return newClients;
}

// ==================== RELATIONSHIPS ====================

const RELATIONSHIPS_FILE = path.join(DATA_DIR, 'relationships.json');

async function readRelationships(): Promise<Relationship[]> {
  // Check cache first
  const cached = cache.get<Relationship[]>(CACHE_KEYS.RELATIONSHIPS);
  if (cached) {
    return cached;
  }
  
  try {
    await ensureDataDirectory();
    const data = await fs.readFile(RELATIONSHIPS_FILE, 'utf-8');
    const relationships = parseJsonFile<Relationship[]>(data, RELATIONSHIPS_FILE);
    cache.set(CACHE_KEYS.RELATIONSHIPS, relationships);
    return relationships;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function writeRelationships(relationships: Relationship[]): Promise<void> {
  await ensureDataDirectory();
  await fs.writeFile(RELATIONSHIPS_FILE, JSON.stringify(relationships, null, 2));
  // Invalidate relationship-related caches
  cache.invalidateByPrefix(CACHE_PREFIXES.RELATIONSHIPS);
}

/**
 * Migration: Set status to 'not_active' for relationships that were
 * incorrectly marked 'active' before client accepted invite or approved a look.
 * Only affects relationships with status 'active' and no acceptedAt.
 */
export async function migrateRelationshipStatuses(): Promise<number> {
  const relationships = await readRelationships();
  let changed = 0;
  for (const r of relationships) {
    if (r.status === 'active' && !r.acceptedAt) {
      (r as Relationship).status = 'not_active';
      changed++;
    }
  }
  if (changed > 0) {
    await writeRelationships(relationships);
    console.log(`✅ Migrated ${changed} relationship(s) from active to not_active (no invite accepted)`);
  }
  return changed;
}

export async function getAllRelationships(): Promise<Relationship[]> {
  return readRelationships();
}

export async function getRelationshipById(id: string): Promise<Relationship | null> {
  const relationships = await readRelationships();
  return relationships.find(r => r.id === id) || null;
}

export async function getRelationshipsByStylist(stylistId: string): Promise<Relationship[]> {
  // Check specific cache first
  const cacheKey = CACHE_KEYS.RELATIONSHIPS_BY_STYLIST(stylistId);
  const cached = cache.get<Relationship[]>(cacheKey);
  if (cached) {
    return cached;
  }
  
  const relationships = await readRelationships();
  const filtered = relationships.filter(r => r.stylistId === stylistId);
  cache.set(cacheKey, filtered);
  return filtered;
}

export async function getRelationshipByStylistAndClient(
  stylistId: string,
  clientId: string
): Promise<Relationship | null> {
  const relationships = await readRelationships();
  return relationships.find(r => r.stylistId === stylistId && r.clientId === clientId) || null;
}

export async function getRelationshipsByClientId(clientId: string): Promise<Relationship[]> {
  const relationships = await readRelationships();
  return relationships.filter(r => r.clientId === clientId && r.status !== 'ended');
}

export async function createRelationship(
  stylistId: string,
  clientId: string,
  status: 'not_active' | 'invited' | 'active' = 'not_active'
): Promise<Relationship> {
  const relationships = await readRelationships();
  
  // Check if THIS stylist already has a relationship with THIS client
  const existing = await getRelationshipByStylistAndClient(stylistId, clientId);
  if (existing) {
    throw new Error('You already have a relationship with this client');
  }

  // NOTE: Multiple stylists CAN have the same client independently.
  // Each stylist-client relationship is isolated - stylists don't see each other's data.
  // This allows the same client email to work with multiple stylists.

  // Set expiration date for invites (7 days from now)
  const expiresAt = status === 'invited' 
    ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    : undefined;

  const newRelationship: Relationship = {
    id: `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    stylistId,
    clientId,
    status,
    inviteToken: status === 'invited' ? `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : undefined,
    expiresAt,
    createdAt: new Date().toISOString(),
  };

  relationships.push(newRelationship);
  await writeRelationships(relationships);
  
  return newRelationship;
}

export async function updateRelationshipStatus(
  id: string,
  status: 'not_active' | 'invited' | 'active' | 'ended'
): Promise<Relationship | null> {
  const relationships = await readRelationships();
  const index = relationships.findIndex(r => r.id === id);
  
  if (index === -1) {
    return null;
  }

  const relationship = relationships[index];

  // NOTE: Multiple stylists CAN have active relationships with the same client independently

  // Set/update expiration date when status changes to 'invited'
  const expiresAt = status === 'invited' 
    ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    : relationship.expiresAt;

  relationships[index] = {
    ...relationship,
    status,
    expiresAt,
    acceptedAt: status === 'active' && !relationship.acceptedAt 
      ? new Date().toISOString() 
      : relationship.acceptedAt,
    endedAt: status === 'ended' && !relationship.endedAt 
      ? new Date().toISOString() 
      : relationship.endedAt,
  };

  await writeRelationships(relationships);
  
  return relationships[index];
}

// ==================== CLOSETS ====================

const CLOSETS_FILE = path.join(DATA_DIR, 'closets.json');

async function readClosets(): Promise<Closet[]> {
  // Check cache first
  const cached = cache.get<Closet[]>(CACHE_KEYS.CLOSETS);
  if (cached) {
    return cached;
  }
  
  try {
    await ensureDataDirectory();
    const data = await fs.readFile(CLOSETS_FILE, 'utf-8');
    const closets = parseJsonFile<Closet[]>(data, CLOSETS_FILE);
    cache.set(CACHE_KEYS.CLOSETS, closets);
    return closets;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function writeClosets(closets: Closet[]): Promise<void> {
  await ensureDataDirectory();
  await fs.writeFile(CLOSETS_FILE, JSON.stringify(closets, null, 2));
  // Invalidate closet-related caches
  cache.invalidateByPrefix(CACHE_PREFIXES.CLOSETS);
}

export async function getAllClosets(): Promise<Closet[]> {
  return readClosets();
}

export async function getClosetById(id: string): Promise<Closet | null> {
  // Check specific cache first
  const cacheKey = CACHE_KEYS.CLOSET_BY_ID(id);
  const cached = cache.get<Closet>(cacheKey);
  if (cached) {
    return cached;
  }
  
  const closets = await readClosets();
  const closet = closets.find(c => c.id === id) || null;
  if (closet) {
    cache.set(cacheKey, closet);
  }
  return closet;
}

export async function getClosetByOwnerId(ownerId: string): Promise<Closet | null> {
  const closets = await readClosets();
  return closets.find(c => c.ownerId === ownerId && c.stylistId == null) || null;
}

/** Get closet scoped to stylist-client (each stylist has independent closet per client) */
export async function getClosetByStylistAndClient(
  stylistId: string | null,
  ownerId: string
): Promise<Closet | null> {
  const cacheKey = CACHE_KEYS.CLOSET_BY_STYLIST_OWNER(stylistId, ownerId);
  const cached = cache.get<Closet>(cacheKey);
  if (cached) return cached;

  const closets = await readClosets();
  const closet = closets.find(
    c =>
      c.ownerId === ownerId &&
      ((c.stylistId != null && c.stylistId === stylistId) ||
        (c.stylistId == null && stylistId == null))
  ) || null;
  if (closet) cache.set(cacheKey, closet);
  return closet;
}

/** Get all closets for a client (for cascade delete) */
export async function getClosetsByOwnerId(ownerId: string): Promise<Closet[]> {
  const closets = await readClosets();
  return closets.filter(c => c.ownerId === ownerId);
}

export async function getOrCreateCloset(
  stylistId: string | null,
  ownerId: string,
  createdBy: string
): Promise<Closet> {
  const closets = await readClosets();

  // For stylists: find closet that belongs to THIS stylist (exact match)
  let existing: Closet | undefined;
  if (stylistId != null) {
    existing = closets.find(
      c => c.ownerId === ownerId && c.stylistId === stylistId
    );
    if (!existing) {
      // Legacy: claim unclaimed closet only if created by THIS stylist
      const legacy = closets.find(
        c => c.ownerId === ownerId && (c.stylistId == null || c.stylistId === undefined) && c.createdBy === stylistId
      );
      if (legacy) {
        (legacy as Closet).stylistId = stylistId;
        await writeClosets(closets);
        return legacy as Closet;
      }
    }
  } else {
    // Client: find their own closet (stylistId null)
    existing = closets.find(
      c => c.ownerId === ownerId && (c.stylistId == null || c.stylistId === undefined)
    );
  }

  if (existing) return existing;

  const newCloset: Closet = {
    id: `closet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    stylistId,
    ownerId,
    createdBy,
    name: 'My Closet',
    createdAt: new Date().toISOString(),
  };

  closets.push(newCloset);
  await writeClosets(closets);
  return newCloset;
}

/** Create a new closet for an owner (multiple closets per client). Name is required and must be unique per client. */
export async function createCloset(
  ownerId: string,
  createdBy: string,
  options: { stylistId?: string | null; name?: string } = {}
): Promise<Closet> {
  const { stylistId = null, name } = options;
  const trimmedName = (name ?? '').trim();
  if (!trimmedName) {
    const err = new Error('CLOSET_NAME_REQUIRED') as Error & { code?: string };
    err.code = 'CLOSET_NAME_REQUIRED';
    throw err;
  }
  const existing = await getClosetsByOwnerId(ownerId);
  const lower = trimmedName.toLowerCase();
  const duplicate = existing.some(c => c.name.trim().toLowerCase() === lower);
  if (duplicate) {
    const err = new Error('DUPLICATE_CLOSET_NAME') as Error & { code?: string };
    err.code = 'DUPLICATE_CLOSET_NAME';
    throw err;
  }
  const closets = await readClosets();
  const newCloset: Closet = {
    id: `closet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    stylistId: stylistId ?? undefined,
    ownerId,
    createdBy,
    name: trimmedName,
    createdAt: new Date().toISOString(),
  };
  closets.push(newCloset);
  await writeClosets(closets);
  return newCloset;
}

export async function deleteCloset(id: string): Promise<boolean> {
  const closets = await readClosets();
  const filtered = closets.filter(c => c.id !== id);
  if (filtered.length === closets.length) return false;
  await writeClosets(filtered);
  return true;
}

// ==================== CLOSET ITEMS ====================

const CLOSET_ITEMS_FILE = path.join(DATA_DIR, 'closet_items.json');

async function readClosetItems(): Promise<ClosetItem[]> {
  // Check cache first
  const cached = cache.get<ClosetItem[]>(CACHE_KEYS.CLOSET_ITEMS);
  if (cached) {
    return cached;
  }
  
  try {
    await ensureDataDirectory();
    const data = await fs.readFile(CLOSET_ITEMS_FILE, 'utf-8');
    const items = parseJsonFile<ClosetItem[]>(data, CLOSET_ITEMS_FILE);
    cache.set(CACHE_KEYS.CLOSET_ITEMS, items);
    return items;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function writeClosetItems(items: ClosetItem[]): Promise<void> {
  await ensureDataDirectory();
  await fs.writeFile(CLOSET_ITEMS_FILE, JSON.stringify(items, null, 2));
  // Invalidate closet items caches
  cache.invalidateByPrefix(CACHE_PREFIXES.CLOSET_ITEMS);
}

export async function getAllClosetItems(closetId?: string): Promise<ClosetItem[]> {
  if (closetId) {
    // Check specific cache first
    const cacheKey = CACHE_KEYS.CLOSET_ITEMS_BY_CLOSET(closetId);
    const cached = cache.get<ClosetItem[]>(cacheKey);
    if (cached) {
      return cached;
    }
    
    const items = await readClosetItems();
    const filtered = items.filter(item => item.closetId === closetId);
    cache.set(cacheKey, filtered);
    return filtered;
  }
  return readClosetItems();
}

export async function getClosetItemById(id: string): Promise<ClosetItem | null> {
  const items = await readClosetItems();
  return items.find(item => item.id === id) || null;
}

export async function createClosetItem(
  itemData: CreateClosetItemDto,
  createdBy: string
): Promise<ClosetItem> {
  const items = await readClosetItems();
  
  const newItem: ClosetItem = {
    id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...itemData,
    createdBy,
    updatedBy: createdBy,
    archived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  items.push(newItem);
  await writeClosetItems(items);
  
  return newItem;
}

export async function updateClosetItem(
  id: string,
  updates: Partial<ClosetItem>,
  updatedBy: string
): Promise<ClosetItem | null> {
  const items = await readClosetItems();
  const index = items.findIndex(item => item.id === id);
  
  if (index === -1) {
    return null;
  }

  items[index] = {
    ...items[index],
    ...updates,
    updatedBy,
    updatedAt: new Date().toISOString(),
  };

  await writeClosetItems(items);
  
  return items[index];
}

export async function deleteClosetItem(id: string): Promise<boolean> {
  const items = await readClosetItems();
  const filtered = items.filter(item => item.id !== id);
  
  if (filtered.length === items.length) {
    return false;
  }

  await writeClosetItems(filtered);
  return true;
}

export async function deleteClosetItemsByClosetId(closetId: string): Promise<number> {
  const items = await readClosetItems();
  const initialLength = items.length;
  const filtered = items.filter(item => item.closetId !== closetId);
  const deletedCount = initialLength - filtered.length;
  await writeClosetItems(filtered);
  return deletedCount;
}

export async function bulkCreateClosetItems(
  itemsData: CreateClosetItemDto[],
  createdBy: string
): Promise<ClosetItem[]> {
  const items = await readClosetItems();
  const now = new Date().toISOString();
  
  const newItems: ClosetItem[] = itemsData.map(data => ({
    id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...data,
    createdBy,
    updatedBy: createdBy,
    archived: false,
    createdAt: now,
    updatedAt: now,
  }));

  items.push(...newItems);
  await writeClosetItems(items);
  
  return newItems;
}

export async function searchClosetItems(
  closetId: string,
  query?: string,
  category?: string
): Promise<ClosetItem[]> {
  let items = await getAllClosetItems(closetId);
  
  if (category) {
    items = items.filter(item => item.category === category);
  }
  
  if (query) {
    const lowerQuery = query.toLowerCase();
    items = items.filter(item =>
      item.name.toLowerCase().includes(lowerQuery) ||
      item.brand?.toLowerCase().includes(lowerQuery) ||
      item.colorTags.some(color => color.toLowerCase().includes(lowerQuery))
    );
  }
  
  return items;
}

// ==================== SUBCATEGORIES ====================

const SUBCATEGORIES_FILE = path.join(DATA_DIR, 'subcategories.json');

async function readSubcategories(): Promise<Subcategory[]> {
  const cached = cache.get<Subcategory[]>(CACHE_KEYS.SUBCATEGORIES);
  if (cached) return cached;
  try {
    await ensureDataDirectory();
    const data = await fs.readFile(SUBCATEGORIES_FILE, 'utf-8');
    const list = parseJsonFile<Subcategory[]>(data, SUBCATEGORIES_FILE);
    cache.set(CACHE_KEYS.SUBCATEGORIES, list);
    return list;
  } catch (error: any) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeSubcategories(list: Subcategory[]): Promise<void> {
  await ensureDataDirectory();
  await fs.writeFile(SUBCATEGORIES_FILE, JSON.stringify(list, null, 2), 'utf-8');
  cache.invalidateByPrefix(CACHE_PREFIXES.SUBCATEGORIES);
}

export async function getSubcategoriesByStylistAndCategory(
  stylistId: string,
  category: ItemCategory
): Promise<Subcategory[]> {
  const all = await readSubcategories();
  return all
    .filter((s) => s.stylistId === stylistId && s.category === category)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export async function createSubcategory(
  stylistId: string,
  category: ItemCategory,
  name: string
): Promise<Subcategory> {
  const list = await readSubcategories();
  const trimmed = name.trim();
  const existing = list.find(
    (s) => s.stylistId === stylistId && s.category === category && s.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (existing) return existing;
  const newSub: Subcategory = {
    id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    stylistId,
    category,
    name: trimmed,
    createdAt: new Date().toISOString(),
  };
  list.push(newSub);
  await writeSubcategories(list);
  return newSub;
}

export async function deleteSubcategory(id: string, stylistId: string): Promise<boolean> {
  const list = await readSubcategories();
  const idx = list.findIndex((s) => s.id === id && s.stylistId === stylistId);
  if (idx === -1) return false;
  list.splice(idx, 1);
  await writeSubcategories(list);
  return true;
}

// ==================== LOOKS ====================

const LOOKS_FILE = path.join(DATA_DIR, 'looks.json');

async function readLooks(): Promise<Look[]> {
  // Check cache first
  const cached = cache.get<Look[]>(CACHE_KEYS.LOOKS);
  if (cached) {
    return cached;
  }
  
  try {
    await ensureDataDirectory();
    const data = await fs.readFile(LOOKS_FILE, 'utf-8');
    const looks = parseJsonFile<Look[]>(data, LOOKS_FILE);
    cache.set(CACHE_KEYS.LOOKS, looks);
    return looks;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function writeLooks(looks: Look[]): Promise<void> {
  await ensureDataDirectory();
  await fs.writeFile(LOOKS_FILE, JSON.stringify(looks, null, 2));
  // Invalidate looks caches
  cache.invalidateByPrefix(CACHE_PREFIXES.LOOKS);
}

export async function getAllLooks(stylistId?: string, clientId?: string): Promise<Look[]> {
  const looks = await readLooks();
  if (stylistId && clientId) {
    return looks.filter(l => l.stylistId === stylistId && l.clientId === clientId);
  }
  if (stylistId) {
    // Check specific cache
    const cacheKey = CACHE_KEYS.LOOKS_BY_STYLIST(stylistId);
    const cached = cache.get<Look[]>(cacheKey);
    if (cached) {
      return cached;
    }
    const filtered = looks.filter(l => l.stylistId === stylistId);
    cache.set(cacheKey, filtered);
    return filtered;
  }
  if (clientId) {
    return looks.filter(l => l.clientId === clientId);
  }
  return looks;
}

export async function getLookById(id: string): Promise<Look | null> {
  // Check specific cache first
  const cacheKey = CACHE_KEYS.LOOK_BY_ID(id);
  const cached = cache.get<Look>(cacheKey);
  if (cached) {
    return cached;
  }
  
  const looks = await readLooks();
  const look = looks.find(l => l.id === id) || null;
  if (look) {
    cache.set(cacheKey, look);
  }
  return look;
}

export async function createLook(
  lookData: CreateLookDto,
  stylistId: string
): Promise<Look> {
  const looks = await readLooks();
  
  const newLook: Look = {
    id: `look_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    stylistId,
    ...lookData,
    status: lookData.status || 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  looks.push(newLook);
  await writeLooks(looks);
  
  return newLook;
}

export async function updateLook(id: string, updates: Partial<Look>): Promise<Look | null> {
  const looks = await readLooks();
  const index = looks.findIndex(l => l.id === id);
  
  if (index === -1) {
    return null;
  }

  looks[index] = {
    ...looks[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await writeLooks(looks);
  
  return looks[index];
}

export async function deleteLook(id: string): Promise<boolean> {
  const looks = await readLooks();
  const filtered = looks.filter(l => l.id !== id);
  if (filtered.length === looks.length) return false;
  await writeLooks(filtered);
  return true;
}

// ==================== LOOK REQUESTS ====================

const LOOK_REQUESTS_FILE = path.join(DATA_DIR, 'look-requests.json');

async function readLookRequests(): Promise<LookRequest[]> {
  try {
    await ensureDataDirectory();
    const data = await fs.readFile(LOOK_REQUESTS_FILE, 'utf-8');
    return parseJsonFile<LookRequest[]>(data, LOOK_REQUESTS_FILE);
  } catch (error: any) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeLookRequests(requests: LookRequest[]): Promise<void> {
  await ensureDataDirectory();
  await fs.writeFile(LOOK_REQUESTS_FILE, JSON.stringify(requests, null, 2));
}

export async function createLookRequest(
  clientId: string,
  stylistId: string,
  itemIds: string[],
  message?: string
): Promise<LookRequest> {
  const requests = await readLookRequests();
  const newRequest: LookRequest = {
    id: `lookreq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    clientId,
    stylistId,
    itemIds,
    message,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  requests.push(newRequest);
  await writeLookRequests(requests);
  return newRequest;
}

export async function getLookRequestsByStylist(stylistId: string): Promise<LookRequest[]> {
  const requests = await readLookRequests();
  return requests
    .filter(r => r.stylistId === stylistId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getLookRequestsByClient(clientId: string): Promise<LookRequest[]> {
  const requests = await readLookRequests();
  return requests
    .filter(r => r.clientId === clientId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getLookRequestById(id: string): Promise<LookRequest | null> {
  const requests = await readLookRequests();
  return requests.find(r => r.id === id) || null;
}

export async function updateLookRequestStatus(
  id: string,
  status: LookRequest['status']
): Promise<LookRequest | null> {
  const requests = await readLookRequests();
  const idx = requests.findIndex(r => r.id === id);
  if (idx === -1) return null;
  requests[idx] = {
    ...requests[idx],
    status,
    completedAt: status === 'completed' ? new Date().toISOString() : requests[idx].completedAt,
    createdAt: requests[idx].createdAt,
  };
  await writeLookRequests(requests);
  return requests[idx];
}

// ==================== LOOK ITEMS ====================

const LOOK_ITEMS_FILE = path.join(DATA_DIR, 'look-items.json');

async function readLookItems(): Promise<LookItem[]> {
  // Check cache first
  const cached = cache.get<LookItem[]>(CACHE_KEYS.LOOK_ITEMS);
  if (cached) {
    return cached;
  }
  
  try {
    await ensureDataDirectory();
    const data = await fs.readFile(LOOK_ITEMS_FILE, 'utf-8');
    const items = parseJsonFile<LookItem[]>(data, LOOK_ITEMS_FILE);
    cache.set(CACHE_KEYS.LOOK_ITEMS, items);
    return items;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function writeLookItems(lookItems: LookItem[]): Promise<void> {
  await ensureDataDirectory();
  await fs.writeFile(LOOK_ITEMS_FILE, JSON.stringify(lookItems, null, 2));
  // Invalidate look items caches
  cache.invalidateByPrefix(CACHE_PREFIXES.LOOK_ITEMS);
}

export async function getAllLookItems(lookId?: string): Promise<LookItem[]> {
  if (lookId) {
    // Check specific cache first
    const cacheKey = CACHE_KEYS.LOOK_ITEMS_BY_LOOK(lookId);
    const cached = cache.get<LookItem[]>(cacheKey);
    if (cached) {
      return cached;
    }
    
    const items = await readLookItems();
    const filtered = items.filter(li => li.lookId === lookId);
    cache.set(cacheKey, filtered);
    return filtered;
  }
  return readLookItems();
}

export async function getLookItemById(id: string): Promise<LookItem | null> {
  const items = await readLookItems();
  return items.find(li => li.id === id) || null;
}

export async function createLookItem(lookItemData: Partial<LookItem>): Promise<LookItem> {
  const items = await readLookItems();
  
  const newItem: LookItem = {
    id: `lookitem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    lookId: lookItemData.lookId!,
    itemId: lookItemData.itemId!,
    itemType: lookItemData.itemType || 'closet_item',
    sortOrder: lookItemData.sortOrder ?? items.filter(li => li.lookId === lookItemData.lookId).length,
    ...(lookItemData.newItemDetails && { newItemDetails: lookItemData.newItemDetails }),
    ...(lookItemData.positionX != null && { positionX: lookItemData.positionX }),
    ...(lookItemData.positionY != null && { positionY: lookItemData.positionY }),
    ...(lookItemData.scale != null && { scale: lookItemData.scale }),
  };

  items.push(newItem);
  await writeLookItems(items);
  
  return newItem;
}

export async function bulkCreateLookItems(itemsData: Partial<LookItem>[]): Promise<LookItem[]> {
  const items = await readLookItems();
  const newItems: LookItem[] = [];
  const baseTime = Date.now();
  
  for (let i = 0; i < itemsData.length; i++) {
    const itemData = itemsData[i];
    // Use baseTime + index to ensure unique IDs even when called in quick succession
    const newItem: LookItem = {
      id: `lookitem_${baseTime + i}_${Math.random().toString(36).substr(2, 9)}`,
      lookId: itemData.lookId!,
      itemId: itemData.itemId!,
      itemType: itemData.itemType || 'closet_item',
      sortOrder: itemData.sortOrder ?? items.filter(li => li.lookId === itemData.lookId).length + i,
      ...(itemData.newItemDetails && { newItemDetails: itemData.newItemDetails }),
      ...(itemData.positionX != null && { positionX: itemData.positionX }),
      ...(itemData.positionY != null && { positionY: itemData.positionY }),
      ...(itemData.scale != null && { scale: itemData.scale }),
    };
    newItems.push(newItem);
    items.push(newItem);
  }
  
  await writeLookItems(items);
  return newItems;
}

export async function updateLookItem(id: string, updates: Partial<LookItem>): Promise<LookItem | null> {
  const items = await readLookItems();
  const index = items.findIndex(li => li.id === id);
  
  if (index === -1) {
    return null;
  }

  items[index] = { ...items[index], ...updates };
  await writeLookItems(items);
  
  return items[index];
}

export async function deleteLookItem(id: string): Promise<boolean> {
  const items = await readLookItems();
  const filtered = items.filter(li => li.id !== id);
  
  if (filtered.length === items.length) {
    return false;
  }

  await writeLookItems(filtered);
  return true;
}

export async function deleteLookItemsByLookId(lookId: string): Promise<number> {
  const items = await readLookItems();
  const initialLength = items.length;
  const filtered = items.filter(li => li.lookId !== lookId);
  const deletedCount = initialLength - filtered.length;
  
  await writeLookItems(filtered);
  return deletedCount;
}

// ==================== CHAT ROOMS (Look-Based) ====================

const CHAT_ROOMS_FILE = path.join(DATA_DIR, 'chat_rooms.json');

async function readChatRooms(): Promise<ChatRoom[]> {
  // Check cache first
  const cached = cache.get<ChatRoom[]>(CACHE_KEYS.CHAT_ROOMS);
  if (cached) {
    return cached;
  }
  
  try {
    await ensureDataDirectory();
    const data = await fs.readFile(CHAT_ROOMS_FILE, 'utf-8');
    const chatRooms = parseJsonFile<ChatRoom[]>(data, CHAT_ROOMS_FILE);
    cache.set(CACHE_KEYS.CHAT_ROOMS, chatRooms);
    return chatRooms;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function writeChatRooms(chatRooms: ChatRoom[]): Promise<void> {
  await ensureDataDirectory();
  await fs.writeFile(CHAT_ROOMS_FILE, JSON.stringify(chatRooms, null, 2));
  // Invalidate chat rooms caches
  cache.invalidateByPrefix(CACHE_PREFIXES.CHAT_ROOMS);
}

export async function getAllChatRooms(): Promise<ChatRoom[]> {
  return readChatRooms();
}

export async function getChatRoomById(id: string): Promise<ChatRoom | null> {
  // Check specific cache first
  const cacheKey = CACHE_KEYS.CHAT_ROOM_BY_ID(id);
  const cached = cache.get<ChatRoom>(cacheKey);
  if (cached) {
    return cached;
  }
  
  const chatRooms = await readChatRooms();
  const chatRoom = chatRooms.find(cr => cr.id === id) || null;
  if (chatRoom) {
    cache.set(cacheKey, chatRoom);
  }
  return chatRoom;
}

export async function getChatRoomByLookId(lookId: string): Promise<ChatRoom | null> {
  // Check specific cache first
  const cacheKey = CACHE_KEYS.CHAT_ROOM_BY_LOOK(lookId);
  const cached = cache.get<ChatRoom>(cacheKey);
  if (cached) {
    return cached;
  }
  
  const chatRooms = await readChatRooms();
  const chatRoom = chatRooms.find(cr => cr.lookId === lookId) || null;
  if (chatRoom) {
    cache.set(cacheKey, chatRoom);
  }
  return chatRoom;
}

export async function getChatRoomsByUserId(userId: string): Promise<ChatRoom[]> {
  // Check specific cache first
  const cacheKey = CACHE_KEYS.CHAT_ROOMS_BY_USER(userId);
  const cached = cache.get<ChatRoom[]>(cacheKey);
  if (cached) {
    return cached;
  }
  
  const chatRooms = await readChatRooms();
  const filtered = chatRooms.filter(cr => cr.stylistId === userId || cr.clientId === userId);
  cache.set(cacheKey, filtered);
  return filtered;
}

export async function getChatRoomsByStylistId(stylistId: string): Promise<ChatRoom[]> {
  const chatRooms = await readChatRooms();
  return chatRooms.filter(cr => cr.stylistId === stylistId);
}

export async function getChatRoomsByClientId(clientId: string): Promise<ChatRoom[]> {
  const chatRooms = await readChatRooms();
  return chatRooms.filter(cr => cr.clientId === clientId);
}

// Create a chat room for a look (1:1 relationship)
export async function createChatRoom(lookId: string, stylistId: string, clientId: string): Promise<ChatRoom> {
  const chatRooms = await readChatRooms();
  
  // Check if chat room already exists for this look (1:1 relationship)
  const existing = await getChatRoomByLookId(lookId);
  if (existing) {
    return existing; // Return existing chat room - no duplicates
  }
  
  const newChatRoom: ChatRoom = {
    id: `chatroom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    lookId,
    stylistId,
    clientId,
    createdAt: new Date().toISOString(),
  };
  
  chatRooms.push(newChatRoom);
  await writeChatRooms(chatRooms);
  
  return newChatRoom;
}

// Get or create chat room for a look
export async function getOrCreateChatRoom(lookId: string, stylistId: string, clientId: string): Promise<ChatRoom> {
  const existing = await getChatRoomByLookId(lookId);
  if (existing) {
    return existing;
  }
  return createChatRoom(lookId, stylistId, clientId);
}

export async function deleteChatRoom(id: string): Promise<boolean> {
  const chatRooms = await readChatRooms();
  const filtered = chatRooms.filter(cr => cr.id !== id);
  
  if (filtered.length === chatRooms.length) {
    return false;
  }
  
  await writeChatRooms(filtered);
  return true;
}

export async function deleteChatRoomByLookId(lookId: string): Promise<boolean> {
  const chatRooms = await readChatRooms();
  const filtered = chatRooms.filter(cr => cr.lookId !== lookId);
  
  if (filtered.length === chatRooms.length) {
    return false;
  }
  
  await writeChatRooms(filtered);
  return true;
}

// ==================== MESSAGES (Look-Based) ====================

const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

async function readMessages(): Promise<Message[]> {
  // Messages are not cached at the "all" level due to high frequency of updates
  // Only specific chat room messages are cached
  try {
    await ensureDataDirectory();
    const data = await fs.readFile(MESSAGES_FILE, 'utf-8');
    return parseJsonFile<Message[]>(data, MESSAGES_FILE);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function writeMessages(messages: Message[]): Promise<void> {
  await ensureDataDirectory();
  await fs.writeFile(MESSAGES_FILE, JSON.stringify(messages, null, 2));
  // Invalidate message caches
  cache.invalidateByPrefix(CACHE_PREFIXES.MESSAGES);
}

// Get all messages for a user (across all their chat rooms)
export async function getAllMessages(userId: string): Promise<Message[]> {
  const messages = await readMessages();
  const userChatRooms = await getChatRoomsByUserId(userId);
  const chatRoomIds = new Set(userChatRooms.map(cr => cr.id));
  
  return messages.filter(m => chatRoomIds.has(m.chatRoomId));
}

// Get messages for a specific chat room
export async function getChatRoomMessages(chatRoomId: string): Promise<Message[]> {
  // Check specific cache first
  const cacheKey = CACHE_KEYS.MESSAGES_BY_CHAT_ROOM(chatRoomId);
  const cached = cache.get<Message[]>(cacheKey);
  if (cached) {
    return cached;
  }
  
  const messages = await readMessages();
  const filtered = messages
    .filter(m => m.chatRoomId === chatRoomId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  
  // Cache for shorter duration (30 seconds) since messages update frequently
  cache.set(cacheKey, filtered, 30);
  return filtered;
}

// Get messages for a specific look (via chat room)
export async function getMessagesByLookId(lookId: string): Promise<Message[]> {
  const chatRoom = await getChatRoomByLookId(lookId);
  if (!chatRoom) {
    return [];
  }
  return getChatRoomMessages(chatRoom.id);
}

// Get chat rooms with enriched data (last message, unread count)
export async function getChatRoomsWithDetails(userId: string): Promise<Array<ChatRoom & { lastMessage?: Message; unreadCount: number }>> {
  const chatRooms = await getChatRoomsByUserId(userId);
  const messages = await readMessages();
  
  return chatRooms.map(chatRoom => {
    const roomMessages = messages
      .filter(m => m.chatRoomId === chatRoom.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    const lastMessage = roomMessages[0];
    const unreadCount = roomMessages.filter(m => 
      m.senderId !== userId && !m.readAt
    ).length;
    
    return {
      ...chatRoom,
      lastMessage,
      unreadCount,
    };
  });
}

// Create a message in a chat room
export async function createMessage(
  messageData: CreateMessageDto,
  senderId: string
): Promise<Message> {
  const messages = await readMessages();
  
  // Verify the chat room exists
  const chatRoom = await getChatRoomById(messageData.chatRoomId);
  if (!chatRoom) {
    throw new Error('Chat room not found');
  }
  
  // Verify sender is part of this chat room
  // For stylists: senderId matches chatRoom.stylistId
  // For clients: senderId is their user ID, we need to check if their client record matches chatRoom.clientId
  let isParticipant = chatRoom.stylistId === senderId;
  
  if (!isParticipant) {
    // Check if sender is the client for this chat room
    // The senderId is a user ID, so we need to find the user and check if their email matches the client
    const { findUserById } = await import('./database');
    const user = await findUserById(senderId);
    if (user) {
      const client = await getClientByEmail(user.email);
      if (client && client.id === chatRoom.clientId) {
        isParticipant = true;
      }
    }
  }
  
  if (!isParticipant) {
    throw new Error('User is not a participant in this chat room');
  }
  
  const newMessage: Message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    chatRoomId: messageData.chatRoomId,
    senderId,
    messageText: messageData.messageText,
    createdAt: new Date().toISOString(),
  };

  messages.push(newMessage);
  await writeMessages(messages);
  
  return newMessage;
}

// Mark messages as read in a chat room
export async function markChatRoomMessagesAsRead(chatRoomId: string, userId: string): Promise<void> {
  const messages = await readMessages();
  const now = new Date().toISOString();
  
  messages.forEach(message => {
    if (
      message.chatRoomId === chatRoomId &&
      message.senderId !== userId &&
      !message.readAt
    ) {
      message.readAt = now;
    }
  });

  await writeMessages(messages);
}

// Delete all messages in a chat room
export async function deleteMessagesByChatRoomId(chatRoomId: string): Promise<number> {
  const messages = await readMessages();
  const initialLength = messages.length;
  const filtered = messages.filter(m => m.chatRoomId !== chatRoomId);
  const deletedCount = initialLength - filtered.length;
  
  await writeMessages(filtered);
  return deletedCount;
}

// DEPRECATED: Old conversation-based functions (kept for migration purposes)
export async function getConversationMessages(
  userId1: string,
  userId2: string
): Promise<Message[]> {
  console.warn('DEPRECATED: getConversationMessages - use getChatRoomMessages instead');
  return [];
}

export async function getConversations(userId: string): Promise<{ userId: string; lastMessage?: Message; unreadCount: number }[]> {
  console.warn('DEPRECATED: getConversations - use getChatRoomsWithDetails instead');
  return [];
}

export async function markMessagesAsRead(userId: string, otherUserId: string): Promise<void> {
  console.warn('DEPRECATED: markMessagesAsRead - use markChatRoomMessagesAsRead instead');
}
