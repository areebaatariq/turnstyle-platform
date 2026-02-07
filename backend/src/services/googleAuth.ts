import { OAuth2Client } from 'google-auth-library';
import { CreateUserDto } from '../types/user';

// Get environment variables
function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const backendBaseUrl =
    process.env.BACKEND_URL?.trim() ||
    process.env.RENDER_EXTERNAL_URL?.trim() ||
    `http://localhost:${process.env.PORT || 3000}`;
  const normalizedBackendUrl = backendBaseUrl.replace(/\/$/, '');
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI?.trim() ||
    `${normalizedBackendUrl}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    console.error('⚠️  ERROR: Google OAuth credentials not configured!');
    console.error('GOOGLE_CLIENT_ID:', clientId ? 'SET' : 'MISSING');
    console.error('GOOGLE_CLIENT_SECRET:', clientSecret ? 'SET' : 'MISSING');
    throw new Error('Google OAuth credentials are required. Please check your .env file.');
  }

  return { clientId, clientSecret, redirectUri };
}

// Lazy initialization to ensure env vars are loaded
let _client: OAuth2Client | null = null;

function getClient(): OAuth2Client {
  if (!_client) {
    const config = getGoogleConfig();
    console.log('✅ Initializing Google OAuth client');
    console.log('Client ID:', config.clientId.substring(0, 20) + '...');
    console.log('Redirect URI:', config.redirectUri);
    _client = new OAuth2Client(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );
  }
  return _client;
}

/**
 * Get Google OAuth authorization URL
 */
export function getGoogleAuthUrl(): string {
  const client = getClient();
  const config = getGoogleConfig();
  
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    prompt: 'consent',
  });
  
  console.log('Generated Google OAuth URL (first 100 chars):', authUrl.substring(0, 100));
  return authUrl;
}

/**
 * Exchange authorization code for tokens and get user info
 */
export async function handleGoogleCallback(code: string): Promise<CreateUserDto> {
  try {
    const client = getClient();
    const config = getGoogleConfig();
    
    // Exchange code for tokens
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Get user info from Google
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: config.clientId,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('Failed to get user information from Google');
    }

    return {
      email: payload.email!,
      name: payload.name || payload.email!.split('@')[0],
      userType: 'stylist', // Default to stylist, can be changed later
      oauthProvider: 'google',
      oauthId: payload.sub,
      profilePhotoUrl: payload.picture,
    };
  } catch (error) {
    console.error('Google OAuth error:', error);
    throw new Error('Failed to authenticate with Google');
  }
}

/**
 * Verify Google ID token (for client-side authentication)
 */
export async function verifyGoogleIdToken(idToken: string): Promise<CreateUserDto> {
  try {
    const client = getClient();
    const config = getGoogleConfig();
    
    const ticket = await client.verifyIdToken({
      idToken,
      audience: config.clientId,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('Failed to verify Google ID token');
    }

    return {
      email: payload.email!,
      name: payload.name || payload.email!.split('@')[0],
      userType: 'stylist',
      oauthProvider: 'google',
      oauthId: payload.sub,
      profilePhotoUrl: payload.picture,
    };
  } catch (error) {
    console.error('Google ID token verification error:', error);
    throw new Error('Failed to verify Google ID token');
  }
}
