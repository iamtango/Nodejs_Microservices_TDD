import { Router } from 'express';
import {
  getFruitsController,
  createFruitController,
  updateFruitController,
  deleteFruitController,
  updateStockController
} from '../controllers/fruitController';

const router = Router();

// Public routes (no auth required for viewing fruits)
// GET /api/fruits - Unified endpoint for getting fruits with filters and pagination
// Query parameters:
//   - id: Get specific fruit by ID
//   - q: Search by name (case-insensitive)
//   - category: Filter by category
//   - hasOffer: Filter fruits with active offers (true/false)
//   - skip: Pagination offset (default: 0)
//   - limit: Number of results (default: 10, max: 100)
router.get('/', getFruitsController);

// Admin routes (these should have admin auth in production)
// POST /api/fruits - Create new fruit
router.post('/', createFruitController);

// PUT /api/fruits/:id - Update fruit
router.put('/:id', updateFruitController);

// PATCH /api/fruits/:id/stock - Update stock
router.patch('/:id/stock', updateStockController);

// DELETE /api/fruits/:id - Delete fruit
router.delete('/:id', deleteFruitController);

export default router;

