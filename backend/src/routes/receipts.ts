import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { getRelationshipsByStylist } from '../utils/database-entities';
import { findUserById } from '../utils/database';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

interface Receipt {
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

interface CreateReceiptDto {
  clientId: string;
  storeName: string;
  purchaseDate: string;
  totalAmount: number;
  itemsList: string[];
  receiptPhotoUrl?: string;
  notes?: string;
}

// Simple JSON file storage (same pattern as other entities)
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const RECEIPTS_FILE = path.join(DATA_DIR, 'receipts.json');

async function ensureDataDirectory() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

async function readReceipts(): Promise<Receipt[]> {
  try {
    await ensureDataDirectory();
    const data = await fs.readFile(RECEIPTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function writeReceipts(receipts: Receipt[]): Promise<void> {
  await ensureDataDirectory();
  await fs.writeFile(RECEIPTS_FILE, JSON.stringify(receipts, null, 2));
}

/**
 * GET /api/receipts
 * Get all receipts for the authenticated stylist
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const stylistId = req.userId!;
    const { clientId } = req.query;
    
    const receipts = await readReceipts();
    let filtered = receipts.filter(r => r.stylistId === stylistId);
    
    if (clientId) {
      filtered = filtered.filter(r => r.clientId === clientId);
    }
    
    res.json({ data: filtered });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * GET /api/receipts/:id
 * Get a specific receipt by ID
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const stylistId = req.userId!;
    
    const receipts = await readReceipts();
    const receipt = receipts.find(r => r.id === id);
    
    if (!receipt) {
      return res.status(404).json({ error: { message: 'Receipt not found' } });
    }
    
    if (receipt.stylistId !== stylistId) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }
    
    res.json({ data: receipt });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * POST /api/receipts
 * Create a new receipt
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const stylistId = req.userId!;
    const receiptData: CreateReceiptDto = req.body;
    
    // Validate required fields
    if (!receiptData.clientId || !receiptData.storeName || !receiptData.purchaseDate || receiptData.totalAmount === undefined) {
      return res.status(400).json({ error: { message: 'clientId, storeName, purchaseDate, and totalAmount are required' } });
    }
    
    // Check if stylist has relationship with client
    const relationships = await getRelationshipsByStylist(stylistId);
    const hasRelationship = relationships.some(r => r.clientId === receiptData.clientId);
    
    if (!hasRelationship) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }
    
    const receipts = await readReceipts();
    const newReceipt: Receipt = {
      id: `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      stylistId,
      ...receiptData,
      itemsList: receiptData.itemsList || [],
      createdAt: new Date().toISOString(),
    };
    
    receipts.push(newReceipt);
    await writeReceipts(receipts);
    
    res.status(201).json({ data: newReceipt });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * PUT /api/receipts/:id
 * Update a receipt
 */
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const stylistId = req.userId!;
    
    const receipts = await readReceipts();
    const index = receipts.findIndex(r => r.id === id);
    
    if (index === -1) {
      return res.status(404).json({ error: { message: 'Receipt not found' } });
    }
    
    if (receipts[index].stylistId !== stylistId) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }
    
    const { id: receiptId, stylistId: receiptStylistId, createdAt, ...updates } = req.body;
    receipts[index] = {
      ...receipts[index],
      ...updates,
    };
    
    await writeReceipts(receipts);
    
    res.json({ data: receipts[index] });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * DELETE /api/receipts/:id
 * Delete a receipt
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const stylistId = req.userId!;
    
    const receipts = await readReceipts();
    const index = receipts.findIndex(r => r.id === id);
    
    if (index === -1) {
      return res.status(404).json({ error: { message: 'Receipt not found' } });
    }
    
    if (receipts[index].stylistId !== stylistId) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }
    
    receipts.splice(index, 1);
    await writeReceipts(receipts);
    
    res.json({ data: { success: true } });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

export default router;
