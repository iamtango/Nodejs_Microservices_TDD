import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  checkout,
  getTransactionHistory,
  getTransactionById
} from '../services/cartService';
import { AddToCartDto, UpdateCartItemDto, CartResponse, CheckoutDto, CheckoutResponse } from '../types';

export const getCartController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const cart = await getCart(userId);

    res.status(200).json({
      success: true,
      message: 'Cart retrieved successfully',
      cart
    } as CartResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve cart'
    } as CartResponse);
  }
};

export const addToCartController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { fruitId, quantity }: AddToCartDto = req.body;

    // Validate fruitId
    if (!fruitId) {
      res.status(400).json({
        success: false,
        message: 'fruitId is required'
      } as CartResponse);
      return;
    }

    // Check if quantity is provided and valid
    if (quantity === undefined || quantity === null) {
      res.status(400).json({
        success: false,
        message: 'quantity is required'
      } as CartResponse);
      return;
    }

    if (quantity <= 0) {
      res.status(400).json({
        success: false,
        message: 'Quantity must be greater than 0'
      } as CartResponse);
      return;
    }

    const cart = await addToCart(userId, { fruitId, quantity });

    res.status(201).json({
      success: true,
      message: 'Item added to cart successfully',
      cart
    } as CartResponse);
  } catch (error: any) {
    const message = error.message || 'Failed to add item to cart';
    const status = message.includes('not found') ? 404 : 
                   message.includes('out of stock') ? 400 : 500;
    res.status(status).json({
      success: false,
      message
    } as CartResponse);
  }
};

export const updateCartItemController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { fruitId } = req.params;
    const { quantity }: UpdateCartItemDto = req.body;

    if (quantity === undefined) {
      res.status(400).json({
        success: false,
        message: 'Quantity is required'
      } as CartResponse);
      return;
    }

    const cart = await updateCartItem(userId, fruitId, { quantity });

    if (!cart) {
      res.status(404).json({
        success: false,
        message: 'Item not found in cart'
      } as CartResponse);
      return;
    }

    res.status(200).json({
      success: true,
      message: quantity <= 0 ? 'Item removed from cart' : 'Cart item updated successfully',
      cart
    } as CartResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update cart item'
    } as CartResponse);
  }
};

export const removeFromCartController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { fruitId } = req.params;

    const cart = await removeFromCart(userId, fruitId);

    if (!cart) {
      res.status(404).json({
        success: false,
        message: 'Item not found in cart'
      } as CartResponse);
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Item removed from cart successfully',
      cart
    } as CartResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to remove item from cart'
    } as CartResponse);
  }
};

export const clearCartController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const cart = await clearCart(userId);

    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
      cart
    } as CartResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to clear cart'
    } as CartResponse);
  }
};

// Checkout controller - creates transaction history
export const checkoutController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { paymentMethod, notes }: CheckoutDto = req.body;
    const authHeader = req.headers.authorization || `Bearer ${req.cookies.token}`;

    if (!paymentMethod) {
      res.status(400).json({
        success: false,
        message: 'Payment method is required'
      } as CheckoutResponse);
      return;
    }

    const transaction = await checkout(userId, { paymentMethod, notes }, authHeader);

    res.status(201).json({
      success: true,
      message: 'Checkout successful',
      transaction
    } as CheckoutResponse);
  } catch (error: any) {
    const message = error.message || 'Checkout failed';
    const status = message.includes('empty') || 
                   message.includes('Invalid') || 
                   message.includes('Insufficient') ? 400 : 500;
    res.status(status).json({
      success: false,
      message
    } as CheckoutResponse);
  }
};

// Get transaction history
export const getTransactionHistoryController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const transactions = await getTransactionHistory(userId);

    res.status(200).json({
      success: true,
      message: 'Transaction history retrieved successfully',
      transactions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve transaction history'
    });
  }
};

// Get single transaction by MongoDB _id
export const getTransactionByIdController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const transaction = await getTransactionById(userId, id);

    if (!transaction) {
      res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Transaction retrieved successfully',
      transaction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve transaction'
    });
  }
};

