import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getGoogleAuthUrl, handleGoogleCallback, verifyGoogleIdToken } from '../services/googleAuth';
import { getAppleAuthUrl, verifyAppleIdToken } from '../services/appleAuth';
import { findUserByEmail, findUserByOAuth, createUser, updateUser } from '../utils/database';
import { generateToken } from '../utils/jwt';
import { errorHandler } from '../middleware/errorHandler';

const router = express.Router();

/**
 * GET /api/auth/google
 * Redirects user to Google OAuth consent screen
 */
router.get('/google', (req: Request, res: Response) => {
  try {
    console.log('Google OAuth redirect requested');
    const authUrl = getGoogleAuthUrl();
    console.log('Redirecting to Google OAuth:', authUrl);
    res.redirect(authUrl);
  } catch (error: any) {
    console.error('Error generating Google OAuth URL:', error);
    errorHandler(error, req, res, () => {});
  }
});

/**
 * GET /api/auth/google/callback
 * Handles Google OAuth callback with authorization code
 */
router.get('/google/callback', async (req: Request, res: Response) => {
  try {
    console.log('Google OAuth callback received');
    console.log('Query params:', req.query);
    const { code } = req.query;
    
    if (!code || typeof code !== 'string') {
      console.error('No authorization code in callback');
      return res.status(400).json({ error: { message: 'Authorization code required' } });
    }

    console.log('Exchanging authorization code for user info...');
    // Exchange code for user info
    const userData = await handleGoogleCallback(code);
    console.log('User data retrieved:', userData.email);

    // Find or create user
    let user = await findUserByOAuth('google', userData.oauthId!);
    
    if (!user) {
      // Check if user exists with same email but different auth method
      const existingUser = await findUserByEmail(userData.email);
      if (existingUser) {
        // Link OAuth account to existing user
        user = await updateUser(existingUser.id, {
          oauthProvider: 'google',
          oauthId: userData.oauthId,
        }) || existingUser;
      } else {
        // Check if there's a client record with this email to determine userType
        // IMPORTANT: When users receive look approval emails, they may not have an account yet.
        // We check if a client record exists with this email to automatically set them as 'client'
        let userType: 'stylist' | 'client' = 'stylist';
        try {
          const { getClientByEmail } = await import('../utils/database-entities');
          
          // Check if a client record exists with this email (regardless of relationship status)
          // This covers both invited clients and clients receiving look approvals
          const client = await getClientByEmail(userData.email);
          if (client) {
            userType = 'client';
            console.log(`✅ CLIENT DETECTED (OAuth): Found client record for ${userData.email}, setting userType to 'client'`);
            console.log(`   Client name: ${client.name}, Client ID: ${client.id}`);
          } else {
            console.log(`ℹ️ No client record found for ${userData.email} (OAuth), defaulting to 'stylist'`);
          }
        } catch (error) {
          console.error('❌ Error checking for client record (OAuth):', error);
        }
        
        // Create new user with determined userType
        user = await createUser({
          ...userData,
          userType: userData.userType || userType,
        });
      }
    }

    // Generate JWT token
    const token = generateToken(user);

    // Redirect to frontend with token and user info
    const frontendUrl = (process.env.FRONTEND_URL?.trim() || req.headers.origin || 'http://localhost:5137').replace(/\/$/, '');
    const userInfo = encodeURIComponent(JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.name,
      userType: user.userType,
      profilePhotoUrl: user.profilePhotoUrl,
      oauthProvider: user.oauthProvider,
    }));
    res.redirect(`${frontendUrl}/auth/callback?token=${token}&provider=google&user=${userInfo}`);
  } catch (error: any) {
    console.error('Google callback error:', error);
    const frontendUrl = (process.env.FRONTEND_URL?.trim() || req.headers.origin || 'http://localhost:5137').replace(/\/$/, '');
    res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(error.message || 'Authentication failed')}`);
  }
});

/**
 * POST /api/auth/google/verify-token
 * Verifies Google ID token from client-side authentication
 * This is the recommended approach for web apps
 */
router.post('/google/verify-token', async (req: Request, res: Response) => {
  try {
    console.log('Received Google verify-token request');
    const { idToken } = req.body;

    if (!idToken) {
      console.error('No ID token provided');
      return res.status(400).json({ error: { message: 'ID token required' } });
    }

    console.log('Verifying Google ID token...');
    // Verify token and get user data
    const userData = await verifyGoogleIdToken(idToken);
    console.log('Token verified, user data:', userData.email);

    // Find or create user
    let user = await findUserByOAuth('google', userData.oauthId!);
    
    if (!user) {
      // Check if user exists with same email
      const existingUser = await findUserByEmail(userData.email);
      if (existingUser) {
        // Link OAuth account to existing user
        user = await updateUser(existingUser.id, {
          oauthProvider: 'google',
          oauthId: userData.oauthId,
        }) || existingUser;
      } else {
        // Check if there's a client record with this email to determine userType
        // IMPORTANT: When users receive look approval emails, they may not have an account yet.
        // We check if a client record exists with this email to automatically set them as 'client'
        let userType: 'stylist' | 'client' = 'stylist';
        try {
          const { getClientByEmail } = await import('../utils/database-entities');
          
          // Check if a client record exists with this email (regardless of relationship status)
          // This covers both invited clients and clients receiving look approvals
          const client = await getClientByEmail(userData.email);
          if (client) {
            userType = 'client';
            console.log(`✅ CLIENT DETECTED (OAuth): Found client record for ${userData.email}, setting userType to 'client'`);
            console.log(`   Client name: ${client.name}, Client ID: ${client.id}`);
          } else {
            console.log(`ℹ️ No client record found for ${userData.email} (OAuth), defaulting to 'stylist'`);
          }
        } catch (error) {
          console.error('❌ Error checking for client record (OAuth):', error);
        }
        
        user = await createUser({
          ...userData,
          userType: userData.userType || userType,
        });
      }
    }

    // Generate JWT token
    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        userType: user.userType,
        profilePhotoUrl: user.profilePhotoUrl,
        oauthProvider: user.oauthProvider,
      },
    });
  } catch (error: any) {
    console.error('Google verify token error:', error);
    res.status(401).json({ error: { message: error.message || 'Failed to verify Google token' } });
  }
});

/**
 * GET /api/auth/apple
 * Redirects user to Apple OAuth consent screen
 */
router.get('/apple', (req: Request, res: Response) => {
  try {
    const authUrl = getAppleAuthUrl();
    res.redirect(authUrl);
  } catch (error: any) {
    errorHandler(error, req, res, () => {});
  }
});

/**
 * POST /api/auth/apple/callback
 * Handles Apple OAuth callback (Apple uses POST for callbacks)
 */
router.post('/apple/callback', async (req: Request, res: Response) => {
  try {
    const { code, id_token } = req.body;

    // Apple can send either code or id_token
    if (!code && !id_token) {
      return res.status(400).json({ error: { message: 'Authorization code or ID token required' } });
    }

    // If we have id_token, use it directly
    if (id_token) {
      const userData = await verifyAppleIdToken(id_token);
      
      // Find or create user
      let user = await findUserByOAuth('apple', userData.oauthId!);
      
      if (!user) {
        const existingUser = await findUserByEmail(userData.email);
        if (existingUser) {
          // Link OAuth account to existing user
          user = await updateUser(existingUser.id, {
            oauthProvider: 'apple',
            oauthId: userData.oauthId,
          }) || existingUser;
        } else {
          // Check if there's a client record with this email to determine userType
          let userType: 'stylist' | 'client' = 'stylist';
          try {
            const { getClientByEmail } = await import('../utils/database-entities');
            
            // Check if a client record exists with this email (regardless of relationship status)
            // This covers both invited clients and clients receiving look approvals
            const client = await getClientByEmail(userData.email);
            if (client) {
              userType = 'client';
              console.log(`Found client record for ${userData.email}, setting userType to 'client'`);
            }
          } catch (error) {
            console.error('Error checking for client record:', error);
          }
          
          user = await createUser({
            ...userData,
            userType: userData.userType || userType,
          });
        }
      }

      const token = generateToken(user);
      const frontendUrl = (process.env.FRONTEND_URL?.trim() || req.headers.origin || 'http://localhost:5137').replace(/\/$/, '');
      return res.redirect(`${frontendUrl}/auth/callback?token=${token}&provider=apple`);
    }

    // If we only have code, we'd need to exchange it (requires client secret)
    // For now, redirect to error
    throw new Error('Authorization code exchange not yet implemented. Use ID token flow.');
  } catch (error: any) {
    console.error('Apple callback error:', error);
    const frontendUrl = (process.env.FRONTEND_URL?.trim() || req.headers.origin || 'http://localhost:5137').replace(/\/$/, '');
    res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(error.message || 'Authentication failed')}`);
  }
});

/**
 * POST /api/auth/apple/verify-token
 * Verifies Apple ID token from client-side authentication
 * This is the recommended approach for web apps
 */
router.post('/apple/verify-token', async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: { message: 'ID token required' } });
    }

    // Verify token and get user data
    const userData = await verifyAppleIdToken(idToken);

    // Find or create user
    let user = await findUserByOAuth('apple', userData.oauthId!);
    
    if (!user) {
      // Check if user exists with same email
      const existingUser = await findUserByEmail(userData.email);
      if (existingUser) {
        // Link OAuth account to existing user
        user = await updateUser(existingUser.id, {
          oauthProvider: 'apple',
          oauthId: userData.oauthId,
        }) || existingUser;
      } else {
        // Check if there's a client record with this email to determine userType
        // IMPORTANT: When users receive look approval emails, they may not have an account yet.
        // We check if a client record exists with this email to automatically set them as 'client'
        let userType: 'stylist' | 'client' = 'stylist';
        try {
          const { getClientByEmail } = await import('../utils/database-entities');
          
          // Check if a client record exists with this email (regardless of relationship status)
          // This covers both invited clients and clients receiving look approvals
          const client = await getClientByEmail(userData.email);
          if (client) {
            userType = 'client';
            console.log(`✅ CLIENT DETECTED (OAuth): Found client record for ${userData.email}, setting userType to 'client'`);
            console.log(`   Client name: ${client.name}, Client ID: ${client.id}`);
          } else {
            console.log(`ℹ️ No client record found for ${userData.email} (OAuth), defaulting to 'stylist'`);
          }
        } catch (error) {
          console.error('❌ Error checking for client record (OAuth):', error);
        }
        
        user = await createUser({
          ...userData,
          userType: userData.userType || userType,
        });
      }
    }

    // Generate JWT token
    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        userType: user.userType,
        profilePhotoUrl: user.profilePhotoUrl,
        oauthProvider: user.oauthProvider,
      },
    });
  } catch (error: any) {
    console.error('Apple verify token error:', error);
    res.status(401).json({ error: { message: error.message || 'Failed to verify Apple token' } });
  }
});

/**
 * POST /api/auth/signup
 * Email/password signup
 */
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, name, userType } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: { message: 'Email, password, and name are required' } });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: { message: 'Password must be at least 8 characters' } });
    }

    // Check if user already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: { message: 'User with this email already exists' } });
    }

    // Determine userType: if provided, use it; otherwise check for client record
    // IMPORTANT: When users receive look approval emails, they may not have an account yet.
    // We check if a client record exists with this email to automatically set them as 'client'
    const { getClientByEmail } = await import('../utils/database-entities');
    let finalUserType: 'stylist' | 'client' = 'stylist';
    
    // Always check for client record first - this is the source of truth
    let client = null;
    try {
      client = await getClientByEmail(email);
    } catch (error) {
      console.error('❌ Error checking for client record:', error);
    }
    
    if (client) {
      // Client record exists - user MUST be a client
      finalUserType = 'client';
      console.log(`✅ CLIENT DETECTED: Found client record for ${email}, setting userType to 'client' for signup`);
      console.log(`   Client name: ${client.name}, Client ID: ${client.id}`);
      
      // If userType was provided but doesn't match, warn (but still set to client)
      if (userType && userType !== 'client') {
        console.warn(`⚠️ WARNING: userType='${userType}' was provided but client record exists. Overriding to 'client'.`);
      }
    } else if (userType) {
      // No client record, but userType explicitly provided - use it
      finalUserType = userType;
      console.log(`ℹ️ No client record found. Using explicitly provided userType: ${userType}`);
    } else {
      // No client record and no explicit userType - default to stylist
      finalUserType = 'stylist';
      console.log(`ℹ️ No client record found for ${email} and no userType provided, defaulting to 'stylist'`);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await createUser({
      email: email.toLowerCase().trim(),
      name: name.trim(),
      userType: finalUserType,
      password: hashedPassword,
    });

    // Generate JWT token
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        userType: user.userType,
        profilePhotoUrl: user.profilePhotoUrl,
      },
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    res.status(500).json({ error: { message: error.message || 'Failed to create account' } });
  }
});

/**
 * POST /api/auth/login
 * Email/password login
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: { message: 'Email and password are required' } });
    }

    // Find user by email
    const user = await findUserByEmail(email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ error: { message: 'Invalid email or password' } });
    }

    // Check if user has a password (email/password account)
    if (!user.password) {
      return res.status(401).json({ 
        error: { message: 'This account uses OAuth authentication. Please sign in with Google or Apple.' } 
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: { message: 'Invalid email or password' } });
    }

    // Generate JWT token
    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        userType: user.userType,
        profilePhotoUrl: user.profilePhotoUrl,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: { message: error.message || 'Failed to login' } });
  }
});

export default router;
