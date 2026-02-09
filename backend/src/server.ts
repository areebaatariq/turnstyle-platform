import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from backend/.env FIRST, before any other imports
// Use __dirname so we always load from the backend folder, not cwd (which can be project root)
const envPath = path.resolve(__dirname, '..', '.env');
console.log('Loading .env from:', envPath);
const envResult = dotenv.config({ path: envPath });

if (envResult.error) {
  console.error('Error loading .env file:', envResult.error);
} else {
  console.log('✅ .env file loaded successfully');
  console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 20)}...` : 'NOT SET');
  console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET');
  console.log('SENDGRID_API_KEY:', process.env.SENDGRID_API_KEY ? 'SET' : 'NOT SET');
  console.log('FROM_EMAIL:', process.env.FROM_EMAIL || 'NOT SET');
}

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { initializeSocketIO } from './socket/socket';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import clientRoutes from './routes/clients';
import relationshipRoutes from './routes/relationships';
import closetRoutes from './routes/closets';
import closetItemRoutes from './routes/closet-items';
import lookRoutes from './routes/looks';
import lookItemRoutes from './routes/look-items';
import messageRoutes from './routes/messages';
import receiptRoutes from './routes/receipts';
import inviteRoutes from './routes/invites';
import lookRequestRoutes from './routes/look-requests';
import bootstrapRoutes from './routes/bootstrap';
import subcategoryRoutes from './routes/subcategories';
import { errorHandler } from './middleware/errorHandler';
import { migrateRelationshipStatuses } from './utils/database-entities';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize Socket.IO
initializeSocketIO(httpServer);

// Middleware
const frontendOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5137',
  'https://turnstyle.onrender.com',
  'https://turnstyle-wardrobe.onrender.com',
].filter((origin): origin is string => Boolean(origin));

app.use(cors({
  origin: frontendOrigins,
  credentials: true,
}));
// Increase body size limit to handle bulk uploads with multiple base64 images
// Note: Frontend sends in chunks; this allows large single requests if needed (e.g. 100+ items)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    console.log('📥 POST/PUT/PATCH Request Details:');
    console.log('   Path:', req.path);
    console.log('   Headers:', JSON.stringify(req.headers, null, 2));
    if (req.body && Object.keys(req.body).length > 0) {
      console.log('   Body:', JSON.stringify(req.body, null, 2));
    }
  }
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Email config check (for testing)
app.get('/health/email', async (req, res) => {
  try {
    const { verifyEmailConfig } = await import('./services/emailService');
    const isConfigured = await verifyEmailConfig();
    const apiKey = process.env.SENDGRID_API_KEY || '';
    res.json({ 
      emailConfigured: isConfigured,
      hasSendGridApiKey: !!process.env.SENDGRID_API_KEY,
      hasFromEmail: !!process.env.FROM_EMAIL,
      fromEmail: process.env.FROM_EMAIL || 'noreply@turnstyle.com',
      apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'not set',
    });
  } catch (error: any) {
    res.status(500).json({ 
      emailConfigured: false,
      error: error.message 
    });
  }
});

// Test email endpoint (for debugging)
app.post('/test/email', async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) {
      return res.status(400).json({ error: 'Email address "to" is required' });
    }

    const { sendInvitationEmail } = await import('./services/emailService');
    await sendInvitationEmail({
      to,
      clientName: 'Test User',
      stylistName: 'Test Stylist',
      inviteLink: `${(process.env.FRONTEND_URL || 'http://localhost:5137').replace(/\/$/, '')}/test-invite`,
      customMessage: 'This is a test email from Turnstyle.',
    });

    res.json({ 
      success: true,
      message: `Test email sent to ${to}. Check the server logs for details.`
    });
  } catch (error: any) {
    console.error('Test email error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/relationships', relationshipRoutes);
app.use('/api/closets', closetRoutes);
app.use('/api/closet-items', closetItemRoutes);
app.use('/api/looks', lookRoutes);
app.use('/api/look-items', lookItemRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/look-requests', lookRequestRoutes);
app.use('/api/bootstrap', bootstrapRoutes);
app.use('/api/subcategories', subcategoryRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

httpServer.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5137'}`);
  console.log(`🔌 Socket.IO server ready for real-time messaging`);
  try {
    await migrateRelationshipStatuses();
  } catch (e) {
    console.error('Migration warning:', e);
  }
});
