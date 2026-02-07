import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireStylist } from '../middleware/roleGuard';
import {
  getSubcategoriesByStylistAndCategory,
  createSubcategory,
  deleteSubcategory,
} from '../utils/database-entities';
import { ItemCategory } from '../types';

const router = express.Router();
router.use(authenticateToken);

const VALID_CATEGORIES: ItemCategory[] = [
  'tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'accessories', 'bags', 'others',
];

/**
 * GET /api/subcategories?category=tops
 * List subcategories for the current stylist and main category.
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const category = (req.query.category as string)?.toLowerCase();
    if (!category || !VALID_CATEGORIES.includes(category as ItemCategory)) {
      return res.status(400).json({ error: { message: 'Valid category query is required' } });
    }
    // Only stylists have subcategories; clients get empty list
    if (req.userType !== 'stylist') {
      return res.json({ data: [] });
    }
    const list = await getSubcategoriesByStylistAndCategory(userId, category as ItemCategory);
    res.json({ data: list });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * POST /api/subcategories
 * Create a subcategory (stylist only).
 * Body: { category: ItemCategory, name: string }
 */
router.post('/', requireStylist, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { category, name } = req.body;
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: { message: 'Valid category is required' } });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: { message: 'Subcategory name is required' } });
    }
    const sub = await createSubcategory(userId, category, name.trim());
    res.status(201).json({ data: sub });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * DELETE /api/subcategories/:id
 * Delete a subcategory (stylist only).
 */
router.delete('/:id', requireStylist, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const deleted = await deleteSubcategory(id, userId);
    if (!deleted) {
      return res.status(404).json({ error: { message: 'Subcategory not found' } });
    }
    res.json({ data: { success: true } });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

export default router;
