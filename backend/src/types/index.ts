export type RelationshipStatus = 'not_active' | 'invited' | 'active' | 'ended';
export type LookStatus = 'draft' | 'pending' | 'approved' | 'changes_requested';

export type ItemCategory = 
  | 'tops' 
  | 'bottoms' 
  | 'dresses' 
  | 'outerwear' 
  | 'shoes' 
  | 'accessories' 
  | 'bags'
  | 'others';

export interface Relationship {
  id: string;
  stylistId: string;
  clientId: string;
  status: RelationshipStatus;
  inviteToken?: string;
  acceptedAt?: string;
  endedAt?: string;
  expiresAt?: string; // ISO timestamp - invite expires after 7 days
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  sizeTop?: string;
  sizeBottom?: string;
  sizeDress?: string;
  sizeShoes?: string;
  braSize?: string;
  colorPreferences?: string;
  profilePhotoUrl?: string;
  /** Which features do you love about yourself? */
  featuresYouLove?: string;
  /** What specific colors make up the bulk of your wardrobe? */
  wardrobeColors?: string;
  /** How would you describe your personal style? (e.g., eclectic, minimal, clean, edgy) */
  personalStyle?: string;
  /** Briefly describe your daily schedule */
  dailySchedule?: string;
  /** Are there any features you don't like as much? */
  featuresYouDislike?: string;
  /** Who are your style icons? */
  styleIcons?: string;
  /** Describe your style icons */
  styleIconsDescription?: string;
  /** Anything else regarding style (aversions, sizing, fabrics, etc.) */
  additionalStyleInfo?: string;
  /** Instagram handle */
  instagramHandle?: string;
  /** Estimate how many outfits you wear in a given day */
  outfitsPerDayEstimate?: string;
  /** Weekday outfits for work and/or home typically include */
  weekdayOutfitDetails?: string;
  relationshipId?: string;
  relationshipStatus?: RelationshipStatus;
}

export interface CreateClientDto {
  name: string;
  email: string;
  phone?: string;
  sizeTop?: string;
  sizeBottom?: string;
  sizeDress?: string;
  sizeShoes?: string;
  braSize?: string;
  colorPreferences?: string;
  profilePhotoUrl?: string;
  featuresYouLove?: string;
  wardrobeColors?: string;
  personalStyle?: string;
  dailySchedule?: string;
  featuresYouDislike?: string;
  styleIcons?: string;
  styleIconsDescription?: string;
  additionalStyleInfo?: string;
  instagramHandle?: string;
  outfitsPerDayEstimate?: string;
  weekdayOutfitDetails?: string;
}

export interface Closet {
  id: string;
  /** Stylist who owns this closet view (null = client's own closet). Omitted in legacy data. */
  stylistId?: string | null;
  ownerId: string;
  createdBy: string;
  name: string;
  createdAt: string;
}

export interface ClosetItem {
  id: string;
  closetId: string;
  name: string;
  category: ItemCategory;
  subcategory?: string;
  brand?: string;
  size?: string;
  colorTags: string[];
  photoUrl: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  itemType?: string;
  notes?: string;
  purchaseInfo?: string;
  createdBy: string;
  updatedBy: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  lastWorn?: string;
}

/** Stylist-created subcategory under a main category */
export interface Subcategory {
  id: string;
  stylistId: string;
  category: ItemCategory;
  name: string;
  createdAt: string;
}

export interface CreateClosetItemDto {
  closetId: string;
  name: string;
  category: ItemCategory;
  subcategory?: string;
  brand?: string;
  size?: string;
  colorTags: string[];
  photoUrl: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  itemType?: string;
  notes?: string;
  purchaseInfo?: string;
}

export interface Look {
  id: string;
  stylistId: string;
  clientId: string;
  name: string;
  occasion?: string;
  eventDate?: string;
  stylingNotes?: string;
  status: LookStatus;
  parentLookId?: string;
  compositeImageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLookDto {
  clientId: string;
  name: string;
  occasion?: string;
  eventDate?: string;
  stylingNotes?: string;
  status?: LookStatus;
  parentLookId?: string;
}

export interface LookItem {
  id: string;
  lookId: string;
  itemId: string;
  itemType: 'closet_item' | 'new_purchase';
  newItemDetails?: any;
  sortOrder: number;
  /** X position as percentage (0-100) for canvas layout */
  positionX?: number;
  /** Y position as percentage (0-100) for canvas layout */
  positionY?: number;
  /** Scale factor for item size (1 = default, 0.5 = half, 2 = double) */
  scale?: number;
}

// ChatRoom: 1:1 relationship with Look - no look = no chat
export interface ChatRoom {
  id: string;
  lookId: string;        // 1:1 relationship with Look
  stylistId: string;     // The stylist who created the look
  clientId: string;      // The client for whom the look was created
  createdAt: string;
}

// Message now belongs to a ChatRoom (which is linked to a Look)
export interface Message {
  id: string;
  chatRoomId: string;    // Reference to ChatRoom (look-based)
  senderId: string;
  messageText: string;
  readAt?: string;
  createdAt: string;
}

export interface CreateMessageDto {
  chatRoomId: string;    // Must specify which look-chat to send to
  messageText: string;
}

export interface LookRequest {
  id: string;
  clientId: string;
  stylistId: string;
  itemIds: string[];
  message?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'declined';
  createdAt: string;
  completedAt?: string;
}

export interface Receipt {
  id: string;
  stylistId: string;
  clientId: string;
  storeName: string;
  purchaseDate: string;
  totalAmount: number;
  itemsList: string[];
  receiptPhotoUrl?: string;
  notes?: string;
  createdAt: string;
}
