import { Router } from 'express';
import {
  getCartController,
  addToCartController,
  updateCartItemController,
  removeFromCartController,
  clearCartController,
  checkoutController,
  getTransactionHistoryController,
  getTransactionByIdController
} from '../controllers/cartController';

const router = Router();

// GET /api/cart - Get user's cart
router.get('/', getCartController);

// POST /api/cart/items - Add item to cart
router.post('/items', addToCartController);

// PUT /api/cart/items/:fruitId - Update item quantity
router.put('/items/:fruitId', updateCartItemController);

// DELETE /api/cart/items/:fruitId - Remove item from cart
router.delete('/items/:fruitId', removeFromCartController);

// DELETE /api/cart - Clear entire cart
router.delete('/', clearCartController);

// POST /api/cart/checkout - Checkout and create transaction
router.post('/checkout', checkoutController);

// GET /api/cart/transactions - Get transaction history
router.get('/transactions', getTransactionHistoryController);

// GET /api/cart/transactions/:id - Get specific transaction (uses MongoDB _id)
router.get('/transactions/:id', getTransactionByIdController);

export default router;

