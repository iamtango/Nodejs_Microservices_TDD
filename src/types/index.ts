import { OfferType } from '../models/fruit';

export interface CartItem {
  fruitId: string;         // MongoDB ObjectId - used as cart item identifier
  name: string;
  price: number;
  quantity: number;
  offerType: OfferType;
  freeItems: number;       // Number of free items from offer
  addedAt: Date;
}

export interface Cart {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  discountAmount: number;
  finalPrice: number;
  updatedAt: Date;
}

export interface AddToCartDto {
  fruitId: string;         // MongoDB ObjectId of the fruit
  quantity: number;
}

export interface UpdateCartItemDto {
  quantity: number;
}

export interface CartResponse {
  success: boolean;
  message: string;
  cart?: Cart;
}

export interface CheckoutDto {
  paymentMethod: string;
  notes?: string;
}

export interface CheckoutResponse {
  success: boolean;
  message: string;
  transactionId?: string;
  transaction?: any;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface FruitResponse {
  success: boolean;
  message: string;
  fruit?: any;
  fruits?: any[];
  pagination?: PaginationInfo;
}

export interface AuthUser {
  userId: string;
  email: string;
}
