import { Cart, CartItem, AddToCartDto, UpdateCartItemDto, CheckoutDto } from '../types';
import Fruit, { OfferType } from '../models/fruit';
import CartModel, { ICart, ICartItem } from '../models/cart';
import TransactionHistory, { PaymentMethod, TransactionStatus, ITransactionItem, ITransactionHistory } from '../models/transactionHistory';
import { Types } from 'mongoose';
import axios from 'axios';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001/api/auth';

// Flag to use in-memory storage for testing
const USE_IN_MEMORY = process.env.NODE_ENV === 'test';

// In-memory cart storage for testing
const inMemoryCarts: Map<string, Cart> = new Map();

// Calculate paid items from total quantity based on offer type
// The offer logic works as follows:
// - For "Buy X Get Y Free": You pay for X items and get Y items free
// - First cycle: Pay X, get Y free (total X+Y items)
// - Subsequent cycles: Pay 1, get (X+Y-1) free (each additional paid item allows another full batch)
const calculatePaidAndFree = (totalQuantity: number, offerType: OfferType): { paid: number; free: number } => {
  if (totalQuantity <= 0) return { paid: 0, free: 0 };

  switch (offerType) {
    case OfferType.BUY_1_GET_1_FREE: {
      // Buy 1 Get 1 Free: Cycle of 2 items
      // 1 item -> 1 paid (offer not fully used yet)
      // 2 items -> 1 paid, 1 free (1 complete cycle)
      // 3 items -> 2 paid, 1 free (1 complete cycle + 1 extra paid)
      // 4 items -> 2 paid, 2 free (2 complete cycles)
      // 5 items -> 3 paid, 2 free (2 complete cycles + 1 extra paid)
      const cycleSize = 2; // 1 paid + 1 free
      const paidPerCycle = 1;
      const completeCycles = Math.floor(totalQuantity / cycleSize);
      const remainder = totalQuantity % cycleSize;
      const paid = completeCycles * paidPerCycle + remainder;
      const free = totalQuantity - paid;
      return { paid, free };
    }
    case OfferType.BUY_2_GET_3_FREE: {
      // Buy 2 Get 3 Free: 
      // - First cycle: Pay 2, get 3 free (5 items total)
      // - After first cycle, each additional paid item completes another 5-item batch
      // Examples (price per orange = Rs. 20):
      // 1 item -> 1 paid (Rs. 20)
      // 2 items -> 2 paid (Rs. 40) - offer ready, can add 3 free
      // 3-5 items -> 2 paid, rest free (Rs. 40)
      // 6 items -> 3 paid, 3 free (Rs. 60) - 6th starts second batch
      // 7-10 items -> 3 paid, rest free (Rs. 60)
      // 11 items -> 4 paid, 7 free (Rs. 80)
      // and so on...
      const cycleSize = 5; // 2 paid + 3 free for first cycle, 1 paid + 4 free after
      const firstCyclePaid = 2;
      
      if (totalQuantity <= cycleSize) {
        // First cycle: pay up to 2
        const paid = Math.min(totalQuantity, firstCyclePaid);
        const free = totalQuantity - paid;
        return { paid, free };
      } else {
        // After first cycle: each additional 5 items costs 1 more paid item
        const afterFirstCycle = totalQuantity - cycleSize;
        const additionalPaid = Math.ceil(afterFirstCycle / cycleSize);
        const paid = firstCyclePaid + additionalPaid;
        const free = totalQuantity - paid;
        return { paid, free };
      }
    }
    case OfferType.BUY_3_GET_5_FREE: {
      // Buy 3 Get 5 Free:
      // - First cycle: Pay 3, get 5 free (8 items total)
      // - After first cycle, each additional paid item completes another 8-item batch
      // Examples:
      // 1-3 items -> 1-3 paid (pay for what you take)
      // 4-8 items -> 3 paid, rest free
      // 9-16 items -> 4 paid, rest free
      // 17-24 items -> 5 paid, rest free
      const cycleSize = 8; // 3 paid + 5 free for first cycle
      const firstCyclePaid = 3;
      
      if (totalQuantity <= cycleSize) {
        // First cycle: pay up to 3
        const paid = Math.min(totalQuantity, firstCyclePaid);
        const free = totalQuantity - paid;
        return { paid, free };
      } else {
        // After first cycle: each additional 8 items costs 1 more paid item
        const afterFirstCycle = totalQuantity - cycleSize;
        const additionalPaid = Math.ceil(afterFirstCycle / cycleSize);
        const paid = firstCyclePaid + additionalPaid;
        const free = totalQuantity - paid;
        return { paid, free };
      }
    }
    default:
      return { paid: totalQuantity, free: 0 };
  }
};

// Calculate discount based on offers
const calculateDiscount = (items: ICartItem[] | CartItem[]): number => {
  return items.reduce((discount, item) => {
    const freeItemValue = item.freeItems * item.price;
    return discount + freeItemValue;
  }, 0);
};

const calculateCartTotals = (items: ICartItem[] | CartItem[]): { 
  totalItems: number; 
  totalPrice: number;
  discountAmount: number;
  finalPrice: number;
} => {
  const totalItems = items.reduce((sum, item) => sum + item.quantity + item.freeItems, 0);
  const totalPrice = items.reduce((sum, item) => sum + (item.price * (item.quantity + item.freeItems)), 0);
  const discountAmount = calculateDiscount(items);
  const finalPrice = totalPrice - discountAmount;
  
  return { 
    totalItems, 
    totalPrice: Math.round(totalPrice * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    finalPrice: Math.round(finalPrice * 100) / 100
  };
};

// Convert MongoDB cart document to API response format
const formatCartResponse = (cart: ICart | null): Cart => {
  if (!cart) {
    return {
      items: [],
      totalItems: 0,
      totalPrice: 0,
      discountAmount: 0,
      finalPrice: 0,
      updatedAt: new Date()
    };
  }
  
  return {
    items: cart.items.map(item => ({
      fruitId: item.fruitId.toString(),
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      offerType: item.offerType,
      freeItems: item.freeItems,
      addedAt: item.addedAt
    })),
    totalItems: cart.totalItems,
    totalPrice: cart.totalPrice,
    discountAmount: cart.discountAmount,
    finalPrice: cart.finalPrice,
    updatedAt: cart.updatedAt
  };
};

// ============================================================
// IN-MEMORY OPERATIONS (for testing)
// ============================================================

const getInMemoryCart = (userId: string): Cart => {
  let cart = inMemoryCarts.get(userId);
  if (!cart) {
    cart = {
      items: [],
      totalItems: 0,
      totalPrice: 0,
      discountAmount: 0,
      finalPrice: 0,
      updatedAt: new Date()
    };
    inMemoryCarts.set(userId, cart);
  }
  return cart;
};

// ============================================================
// MAIN CART OPERATIONS
// ============================================================

export const getCart = async (userId: string): Promise<Cart> => {
  if (USE_IN_MEMORY) {
    return getInMemoryCart(userId);
  }
  const cart = await CartModel.findOne({ userId }).select('-__v');
  return formatCartResponse(cart);
};

export const addToCart = async (userId: string, itemData: AddToCartDto): Promise<Cart> => {
  // Fetch fruit from database
  const fruit = await Fruit.findById(itemData.fruitId);
  
  if (!fruit) {
    throw new Error('Fruit not found');
  }
  
  if (!fruit.inStock || fruit.stockQuantity < itemData.quantity) {
    throw new Error('Fruit is out of stock or insufficient quantity available');
  }

  if (USE_IN_MEMORY) {
    // In-memory implementation for testing
    const cart = getInMemoryCart(userId);
    
    const existingItemIndex = cart.items.findIndex(
      item => item.fruitId === itemData.fruitId
    );
    
    if (existingItemIndex !== -1) {
      const totalQuantity = cart.items[existingItemIndex].quantity + cart.items[existingItemIndex].freeItems + itemData.quantity;
      const { paid, free } = calculatePaidAndFree(totalQuantity, fruit.offerType);
      cart.items[existingItemIndex].quantity = paid;
      cart.items[existingItemIndex].freeItems = free;
    } else {
      const { paid, free } = calculatePaidAndFree(itemData.quantity, fruit.offerType);
      const newItem: CartItem = {
        fruitId: itemData.fruitId,
        name: fruit.name,
        price: fruit.price,
        quantity: paid,
        offerType: fruit.offerType,
        freeItems: free,
        addedAt: new Date()
      };
      cart.items.push(newItem);
    }
    
    const totals = calculateCartTotals(cart.items);
    cart.totalItems = totals.totalItems;
    cart.totalPrice = totals.totalPrice;
    cart.discountAmount = totals.discountAmount;
    cart.finalPrice = totals.finalPrice;
    cart.updatedAt = new Date();
    
    inMemoryCarts.set(userId, cart);
    return cart;
  }
  
  // MongoDB implementation
  let cart = await CartModel.findOne({ userId });
  
  if (!cart) {
    cart = new CartModel({
      userId,
      items: [],
      totalItems: 0,
      totalPrice: 0,
      discountAmount: 0,
      finalPrice: 0
    });
  }
  
  // Check if fruit already exists in cart
  const existingItemIndex = cart.items.findIndex(
    item => item.fruitId.toString() === itemData.fruitId
  );
  
  if (existingItemIndex !== -1) {
    // Update quantity if fruit exists
    const existingItem = cart.items[existingItemIndex];
    const totalQuantity = existingItem.quantity + existingItem.freeItems + itemData.quantity;
    const { paid, free } = calculatePaidAndFree(totalQuantity, fruit.offerType);
    cart.items[existingItemIndex].quantity = paid;
    cart.items[existingItemIndex].freeItems = free;
  } else {
    // Add new item
    const { paid, free } = calculatePaidAndFree(itemData.quantity, fruit.offerType);
    const newItem: ICartItem = {
      fruitId: new Types.ObjectId(itemData.fruitId),
      name: fruit.name,
      price: fruit.price,
      quantity: paid,
      offerType: fruit.offerType,
      freeItems: free,
      addedAt: new Date()
    };
    cart.items.push(newItem);
  }
  
  // Recalculate totals
  const totals = calculateCartTotals(cart.items);
  cart.totalItems = totals.totalItems;
  cart.totalPrice = totals.totalPrice;
  cart.discountAmount = totals.discountAmount;
  cart.finalPrice = totals.finalPrice;
  
  await cart.save();
  return formatCartResponse(cart);
};

export const updateCartItem = async (
  userId: string,
  fruitId: string,
  updateData: UpdateCartItemDto
): Promise<Cart | null> => {
  if (USE_IN_MEMORY) {
    const cart = getInMemoryCart(userId);
    const itemIndex = cart.items.findIndex(item => item.fruitId === fruitId);
    
    if (itemIndex === -1) {
      return null;
    }
    
    if (updateData.quantity <= 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      const { paid, free } = calculatePaidAndFree(updateData.quantity, cart.items[itemIndex].offerType);
      cart.items[itemIndex].quantity = paid;
      cart.items[itemIndex].freeItems = free;
    }
    
    const totals = calculateCartTotals(cart.items);
    cart.totalItems = totals.totalItems;
    cart.totalPrice = totals.totalPrice;
    cart.discountAmount = totals.discountAmount;
    cart.finalPrice = totals.finalPrice;
    cart.updatedAt = new Date();
    
    inMemoryCarts.set(userId, cart);
    return cart;
  }

  const cart = await CartModel.findOne({ userId });
  
  if (!cart) {
    return null;
  }
  
  const itemIndex = cart.items.findIndex(item => item.fruitId.toString() === fruitId);
  
  if (itemIndex === -1) {
    return null;
  }
  
  if (updateData.quantity <= 0) {
    // Remove item if quantity is 0 or less
    cart.items.splice(itemIndex, 1);
  } else {
    // Treat updated quantity as total quantity
    const { paid, free } = calculatePaidAndFree(updateData.quantity, cart.items[itemIndex].offerType);
    cart.items[itemIndex].quantity = paid;
    cart.items[itemIndex].freeItems = free;
  }
  
  // Recalculate totals
  const totals = calculateCartTotals(cart.items);
  cart.totalItems = totals.totalItems;
  cart.totalPrice = totals.totalPrice;
  cart.discountAmount = totals.discountAmount;
  cart.finalPrice = totals.finalPrice;
  
  await cart.save();
  return formatCartResponse(cart);
};

export const removeFromCart = async (userId: string, fruitId: string): Promise<Cart | null> => {
  if (USE_IN_MEMORY) {
    const cart = getInMemoryCart(userId);
    const itemIndex = cart.items.findIndex(item => item.fruitId === fruitId);
    
    if (itemIndex === -1) {
      return null;
    }
    
    cart.items.splice(itemIndex, 1);
    
    const totals = calculateCartTotals(cart.items);
    cart.totalItems = totals.totalItems;
    cart.totalPrice = totals.totalPrice;
    cart.discountAmount = totals.discountAmount;
    cart.finalPrice = totals.finalPrice;
    cart.updatedAt = new Date();
    
    inMemoryCarts.set(userId, cart);
    return cart;
  }

  const cart = await CartModel.findOne({ userId });
  
  if (!cart) {
    return null;
  }
  
  const itemIndex = cart.items.findIndex(item => item.fruitId.toString() === fruitId);
  
  if (itemIndex === -1) {
    return null;
  }
  
  cart.items.splice(itemIndex, 1);
  
  // Recalculate totals
  const totals = calculateCartTotals(cart.items);
  cart.totalItems = totals.totalItems;
  cart.totalPrice = totals.totalPrice;
  cart.discountAmount = totals.discountAmount;
  cart.finalPrice = totals.finalPrice;
  
  await cart.save();
  return formatCartResponse(cart);
};

export const clearCart = async (userId: string): Promise<Cart> => {
  if (USE_IN_MEMORY) {
    inMemoryCarts.delete(userId);
    return {
      items: [],
      totalItems: 0,
      totalPrice: 0,
      discountAmount: 0,
      finalPrice: 0,
      updatedAt: new Date()
    };
  }

  // Delete the cart document from MongoDB
  await CartModel.deleteOne({ userId });
  
  return {
    items: [],
    totalItems: 0,
    totalPrice: 0,
    discountAmount: 0,
    finalPrice: 0,
    updatedAt: new Date()
  };
};

export const checkout = async (userId: string, checkoutData: CheckoutDto, authHeader?: string): Promise<ITransactionHistory> => {
  let cartData: Cart;
  
  if (USE_IN_MEMORY) {
    cartData = getInMemoryCart(userId);
  } else {
    const cart = await CartModel.findOne({ userId });
    if (!cart || cart.items.length === 0) {
      throw new Error('Cart is empty');
    }
    
    // Recalculate totals to ensure they are fresh and not undefined
    const totals = calculateCartTotals(cart.items);
    cart.totalItems = totals.totalItems;
    cart.totalPrice = totals.totalPrice;
    cart.discountAmount = totals.discountAmount;
    cart.finalPrice = totals.finalPrice;
    
    cartData = formatCartResponse(cart);
  }
  
  if (cartData.items.length === 0) {
    throw new Error('Cart is empty');
  }
  
  // Validate payment method
  const paymentMethod = checkoutData.paymentMethod.toUpperCase() as PaymentMethod;
  if (!Object.values(PaymentMethod).includes(paymentMethod)) {
    throw new Error('Invalid payment method');
  }

  // If payment method is WALLET, check and deduct balance
  if (paymentMethod === PaymentMethod.WALLET) {
    try {
      // 1. Check if user has enough balance
      const profileRes = await axios.get(`${AUTH_SERVICE_URL}/profile`, {
        headers: { Authorization: authHeader }
      });
      
      const userBalance = profileRes.data.user.walletBalance;
      if (userBalance < cartData.finalPrice) {
        throw new Error('Insufficient wallet balance');
      }

      // 2. Deduct balance
      await axios.post(`${AUTH_SERVICE_URL}/deduct-balance`, 
        { amount: cartData.finalPrice },
        { headers: { Authorization: authHeader } }
      );
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message;
      throw new Error(`Wallet payment failed: ${errorMessage}`);
    }
  }
  
  // Create transaction items
  const transactionItems: ITransactionItem[] = cartData.items.map(item => {
    const fruitId = Types.ObjectId.isValid(item.fruitId) 
      ? new Types.ObjectId(item.fruitId) 
      : item.fruitId as unknown as Types.ObjectId;

    return {
      fruitId,
      fruitName: item.name,
      quantity: item.quantity,
      pricePerUnit: item.price,
      offerApplied: item.offerType,
      freeItemsReceived: item.freeItems,
      subtotal: item.price * item.quantity
    };
  });
  
  // Create transaction record (MongoDB _id is auto-generated)
  const transaction = new TransactionHistory({
    userId: userId,
    items: transactionItems,
    totalAmount: cartData.totalPrice,
    discountAmount: cartData.discountAmount,
    finalAmount: cartData.finalPrice,
    currency: "INR",
    paymentMethod: paymentMethod,
    status: TransactionStatus.COMPLETED,
    notes: checkoutData.notes
  });
  
  const savedTransaction = await (USE_IN_MEMORY ? Promise.resolve(transaction) : transaction.save());
  
  // Update stock quantities - wrapped in try/catch for test environment compatibility
  for (const item of cartData.items) {
    try {
      await Fruit.findByIdAndUpdate(item.fruitId, {
        $inc: { stockQuantity: -(item.quantity + item.freeItems) }
      });
    } catch (stockError) {
      if (!USE_IN_MEMORY) console.error('Stock update failed:', stockError);
    }
  }
  
  // Trigger notification
  try {
    await axios.post(`${AUTH_SERVICE_URL}/notify-order`, {
      transactionId: savedTransaction._id.toString(),
      amount: savedTransaction.finalAmount
    }, {
      headers: { Authorization: authHeader }
    });
  } catch (notificationError) {
    console.error('Failed to send order notification:', notificationError);
    // We don't throw error here to avoid failing the whole checkout if only notification fails
  }

  // Delete the cart after successful checkout
  if (USE_IN_MEMORY) {
    inMemoryCarts.delete(userId);
    return savedTransaction;
  } else {
    await CartModel.deleteOne({ userId });
  }
  
  // Return the transaction without internal fields
  const result = await TransactionHistory.findById(savedTransaction._id)
    .select('-__v -createdAt -updatedAt')
    .populate({
      path: 'items.fruitId',
      select: '-__v -createdAt -updatedAt'
    });
    
  if (!result) {
    throw new Error('Failed to retrieve transaction details');
  }
    
  return result;
};

export const getTransactionHistory = async (userId: string): Promise<ITransactionHistory[]> => {
  const transactions = await TransactionHistory.find({ userId })
    .select('-__v')
    .sort({ createdAt: -1 })
    .populate({
      path: 'items.fruitId',
      select: '-__v -createdAt -updatedAt'
    });
  return transactions;
};

export const getTransactionById = async (userId: string, id: string): Promise<ITransactionHistory | null> => {
  const transaction = await TransactionHistory.findOne({ 
    userId, 
    _id: id 
  })
  .select('-__v')
  .populate({
    path: 'items.fruitId',
    select: '-__v -createdAt -updatedAt'
  });
  return transaction;
};

// For testing purposes - clears all carts
export const clearAllCarts = async (): Promise<void> => {
  if (USE_IN_MEMORY) {
    inMemoryCarts.clear();
    return;
  }
  await CartModel.deleteMany({});
};
