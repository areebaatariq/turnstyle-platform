import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { CreateUserDto } from '../types/user';

const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID;
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID;
const APPLE_KEY_ID = process.env.APPLE_KEY_ID;
const APPLE_PRIVATE_KEY_PATH = process.env.APPLE_PRIVATE_KEY_PATH;

if (!APPLE_CLIENT_ID) {
  console.warn('⚠️  Apple OAuth credentials not configured. Apple login will not work.');
}

// JWKS client for verifying Apple tokens
const appleJwksClient = jwksClient({
  jwksUri: 'https://appleid.apple.com/auth/keys',
  cache: true,
  cacheMaxAge: 86400000, // 24 hours
});

/**
 * Get Apple OAuth authorization URL
 * Note: Apple Sign In uses a different flow - this is for web-based flow
 */
export function getAppleAuthUrl(): string {
  const backendBaseUrl =
    process.env.BACKEND_URL?.trim() ||
    process.env.RENDER_EXTERNAL_URL?.trim() ||
    `http://localhost:${process.env.PORT || 3000}`;
  const normalizedBackendUrl = backendBaseUrl.replace(/\/$/, '');
  const redirectUri = encodeURIComponent(
    process.env.APPLE_REDIRECT_URI?.trim() ||
      `${normalizedBackendUrl}/api/auth/apple/callback`
  );
  
  return `https://appleid.apple.com/auth/authorize?client_id=${APPLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code%20id_token&scope=email%20name&response_mode=form_post`;
}

/**
 * Verify Apple ID token (for client-side authentication)
 * This is the recommended approach for web apps
 */
export async function verifyAppleIdToken(idToken: string): Promise<CreateUserDto> {
  try {
    // Decode the token to get the header
    const decoded = jwt.decode(idToken, { complete: true });
    if (!decoded || typeof decoded === 'string') {
      throw new Error('Invalid Apple ID token');
    }

    // Get the key ID from the token header
    const kid = decoded.header.kid;
    if (!kid) {
      throw new Error('Token missing kid header');
    }

    // Get the signing key from Apple's JWKS endpoint
    const key = await appleJwksClient.getSigningKey(kid);
    const signingKey = key.getPublicKey();

    // Verify the token
    const payload = jwt.verify(idToken, signingKey, {
      audience: APPLE_CLIENT_ID,
      issuer: 'https://appleid.apple.com',
    }) as any;

    // Extract user information
    // Note: Apple only sends email on first authentication
    // Subsequent logins may not include email in the token
    const email = payload.email;
    if (!email) {
      throw new Error('Email not found in Apple ID token. User may need to re-authenticate.');
    }

    // Name is only provided on first authentication
    const name = payload.name
      ? `${payload.name.firstName || ''} ${payload.name.lastName || ''}`.trim()
      : email.split('@')[0];

    return {
      email,
      name: name || email.split('@')[0],
      userType: 'stylist',
      oauthProvider: 'apple',
      oauthId: payload.sub, // Apple's unique user identifier
    };
  } catch (error) {
    console.error('Apple ID token verification error:', error);
    throw new Error('Failed to verify Apple ID token');
  }
}

/**
 * Generate client secret for Apple (if using server-side flow)
 * This is used for the authorization code exchange flow
 */
export async function generateAppleClientSecret(): Promise<string> {
  if (!APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY_PATH) {
    throw new Error('Apple OAuth credentials not configured');
  }

  // Note: In production, you should load the private key securely
  // This is a simplified version - you'll need to load the .p8 file
  const fs = await import('fs/promises');
  const privateKey = await fs.readFile(APPLE_PRIVATE_KEY_PATH, 'utf8');

  const now = Math.floor(Date.now() / 1000);
  const jwtToken = jwt.sign(
    {
      iss: APPLE_TEAM_ID,
      iat: now,
      exp: now + 15777000, // 6 months
      aud: 'https://appleid.apple.com',
      sub: APPLE_CLIENT_ID,
    },
    privateKey,
    {
      algorithm: 'ES256',
      keyid: APPLE_KEY_ID,
    }
  );

  return jwtToken;
}
