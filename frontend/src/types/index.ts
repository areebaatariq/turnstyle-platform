export type UserType = 'stylist' | 'client';

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

export interface User {
  id: string;
  email: string;
  phone?: string;
  userType: UserType;
  name: string;
  profilePhotoUrl?: string;
  bio?: string;
  location?: string;
  oauthProvider?: 'google' | 'apple';
  createdAt: string;
}

export interface Relationship {
  id: string;
  stylistId: string;
  clientId: string;
  status: RelationshipStatus;
  inviteToken?: string;
  acceptedAt?: string;
  endedAt?: string;
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
  relationshipId?: string;
  relationshipStatus?: RelationshipStatus;
}

export interface Closet {
  id: string;
  /** Stylist who owns this closet view (null = client's own closet) */
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
  /** Generated composite image (white bg, all items arranged) */
  compositeImageUrl?: string;
  createdAt: string;
  updatedAt: string;
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

// ChatRoom: 1:1 relationship with Look - no look = no chat
export interface ChatRoom {
  id: string;
  lookId: string;        // 1:1 relationship with Look
  stylistId: string;     // The stylist who created the look
  clientId: string;      // The client for whom the look was created
  createdAt: string;
  // Enriched data (populated by API)
  look?: Look;
  clientName?: string;
  stylistName?: string;
  lastMessage?: Message;
  unreadCount?: number;
}

// Message belongs to a ChatRoom (which is linked to a Look)
export interface Message {
  id: string;
  chatRoomId: string;    // Reference to ChatRoom (look-based)
  senderId: string;
  messageText: string;
  readAt?: string;
  createdAt: string;
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