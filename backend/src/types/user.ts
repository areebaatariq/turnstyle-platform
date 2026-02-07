export type UserType = 'stylist' | 'client';
export type OAuthProvider = 'google' | 'apple';

export interface User {
  id: string;
  email: string;
  phone?: string;
  userType: UserType;
  name: string;
  profilePhotoUrl?: string;
  bio?: string;
  location?: string;
  oauthProvider?: OAuthProvider;
  oauthId?: string; // Unique ID from OAuth provider
  password?: string; // Hashed password (never sent to frontend)
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDto {
  email: string;
  name: string;
  userType: UserType;
  oauthProvider?: OAuthProvider;
  oauthId?: string;
  profilePhotoUrl?: string;
  phone?: string;
  password?: string; // Hashed password for email/password auth
}
