import request from 'supertest';
import app from '../src/app';
import { clearAllCarts } from '../src/services/cartService';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock the Fruit model for testing
jest.mock('../src/models/fruit', () => {
  const mockFruits: any = {
    'apple-001': {
      _id: 'apple-001',
      name: 'Apple',
      price: 10,
      offerType: 'NONE',
      inStock: true,
      stockQuantity: 100
    },
    'orange-001': {
      _id: 'orange-001',
      name: 'Orange',
      price: 20,
      offerType: 'NONE',
      inStock: true,
      stockQuantity: 100
    },
    // Fruits with offers for testing
    'apple-offer': {
      _id: 'apple-offer',
      name: 'Apple with Offer',
      price: 10,
      offerType: 'BUY_1_GET_1_FREE',
      inStock: true,
      stockQuantity: 100
    },
    'orange-offer': {
      _id: 'orange-offer',
      name: 'Orange with Offer',
      price: 20,
      offerType: 'BUY_2_GET_3_FREE',
      inStock: true,
      stockQuantity: 100
    },
    'mango-offer': {
      _id: 'mango-offer',
      name: 'Mango with Offer',
      price: 30,
      offerType: 'BUY_3_GET_5_FREE',
      inStock: true,
      stockQuantity: 100
    }
  };

  return {
    __esModule: true,
    default: {
      findById: jest.fn((id: string) => Promise.resolve(mockFruits[id] || null)),
      findByIdAndUpdate: jest.fn(() => Promise.resolve())
    },
    OfferType: {
      NONE: 'NONE',
      BUY_1_GET_1_FREE: 'BUY_1_GET_1_FREE',
      BUY_2_GET_3_FREE: 'BUY_2_GET_3_FREE',
      BUY_3_GET_5_FREE: 'BUY_3_GET_5_FREE'
    }
  };
});

describe('Cart Service', () => {
  const testToken = 'Bearer test-user-user123';
  const testUserId = 'user123';

  beforeEach(async () => {
    await clearAllCarts();
  });

  describe('GET /api/cart', () => {
    it('should return empty cart for new user', async () => {
      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', testToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.cart.items).toHaveLength(0);
      expect(response.body.cart.totalItems).toBe(0);
      expect(response.body.cart.totalPrice).toBe(0);
    });

    it('should return 401 without authorization header', async () => {
      const response = await request(app).get('/api/cart');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/cart/items', () => {
    it('should add item to cart successfully', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({
          fruitId: 'apple-001',
          quantity: 2
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.cart.items).toHaveLength(1);
      expect(response.body.cart.items[0].fruitId).toBe('apple-001');
      expect(response.body.cart.items[0].quantity).toBe(2);
      expect(response.body.cart.totalItems).toBe(2);
      expect(response.body.cart.totalPrice).toBe(20); // 2 apples at Rs. 10 each
    });

    it('should increase quantity when adding existing product', async () => {
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({
          fruitId: 'apple-001',
          quantity: 2
        });

      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({
          fruitId: 'apple-001',
          quantity: 3
        });

      expect(response.status).toBe(201);
      expect(response.body.cart.items).toHaveLength(1);
      expect(response.body.cart.items[0].quantity).toBe(5);
      expect(response.body.cart.totalItems).toBe(5);
    });

    it('should add multiple different products', async () => {
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({
          fruitId: 'apple-001',
          quantity: 1
        });

      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({
          fruitId: 'orange-001',
          quantity: 2
        });

      expect(response.status).toBe(201);
      expect(response.body.cart.items).toHaveLength(2);
      expect(response.body.cart.totalItems).toBe(3);
      expect(response.body.cart.totalPrice).toBe(50); // 1 apple (10) + 2 oranges (40)
    });

    it('should return error for missing fruitId', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({
          quantity: 1
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return error for invalid quantity', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({
          fruitId: 'apple-001',
          quantity: -1
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('greater than 0');
    });

    it('should return error for non-existent fruit', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({
          fruitId: 'invalid-fruit-id',
          quantity: 1
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('PUT /api/cart/items/:fruitId', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({
          fruitId: 'apple-001',
          quantity: 2
        });
    });

    it('should update item quantity successfully', async () => {
      const response = await request(app)
        .put('/api/cart/items/apple-001')
        .set('Authorization', testToken)
        .send({ quantity: 5 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.cart.items[0].quantity).toBe(5);
      expect(response.body.cart.totalItems).toBe(5);
      expect(response.body.cart.totalPrice).toBe(50);
    });

    it('should remove item when quantity set to 0', async () => {
      const response = await request(app)
        .put('/api/cart/items/apple-001')
        .set('Authorization', testToken)
        .send({ quantity: 0 });

      expect(response.status).toBe(200);
      expect(response.body.cart.items).toHaveLength(0);
      expect(response.body.message).toContain('removed');
    });

    it('should return 404 for non-existent item', async () => {
      const response = await request(app)
        .put('/api/cart/items/non-existent-id')
        .set('Authorization', testToken)
        .send({ quantity: 5 });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return error when quantity not provided', async () => {
      const response = await request(app)
        .put('/api/cart/items/apple-001')
        .set('Authorization', testToken)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/cart/items/:fruitId', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({
          fruitId: 'apple-001',
          quantity: 2
        });
    });

    it('should remove item from cart successfully', async () => {
      const response = await request(app)
        .delete('/api/cart/items/apple-001')
        .set('Authorization', testToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.cart.items).toHaveLength(0);
    });

    it('should return 404 for non-existent item', async () => {
      const response = await request(app)
        .delete('/api/cart/items/non-existent-id')
        .set('Authorization', testToken);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/cart', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({
          fruitId: 'apple-001',
          quantity: 2
        });

      await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({
          fruitId: 'orange-001',
          quantity: 1
        });
    });

    it('should clear the entire cart', async () => {
      const response = await request(app)
        .delete('/api/cart')
        .set('Authorization', testToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.cart.items).toHaveLength(0);
      expect(response.body.cart.totalItems).toBe(0);
      expect(response.body.cart.totalPrice).toBe(0);
    });
  });

  describe('Cart isolation between users', () => {
    const user1Token = 'Bearer test-user-user1';
    const user2Token = 'Bearer test-user-user2';

    it('should maintain separate carts for different users', async () => {
      // User 1 adds item
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', user1Token)
        .send({
          fruitId: 'apple-001',
          quantity: 1
        });

      // User 2 adds different item
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', user2Token)
        .send({
          fruitId: 'orange-001',
          quantity: 2
        });

      // Check user 1 cart
      const user1Cart = await request(app)
        .get('/api/cart')
        .set('Authorization', user1Token);

      expect(user1Cart.body.cart.items).toHaveLength(1);
      expect(user1Cart.body.cart.items[0].name).toBe('Apple');

      // Check user 2 cart
      const user2Cart = await request(app)
        .get('/api/cart')
        .set('Authorization', user2Token);

      expect(user2Cart.body.cart.items).toHaveLength(1);
      expect(user2Cart.body.cart.items[0].name).toBe('Orange');
    });
  });

  describe('Cart total calculation', () => {
    it('should calculate correct total for apples', async () => {
      // Add 1 apple - should be Rs. 10
      const response1 = await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({ fruitId: 'apple-001', quantity: 1 });

      expect(response1.body.cart.totalPrice).toBe(10);

      // Add another apple - should be Rs. 20
      const response2 = await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({ fruitId: 'apple-001', quantity: 1 });

      expect(response2.body.cart.totalPrice).toBe(20);
    });

    it('should calculate correct total for oranges', async () => {
      // Add 1 orange - should be Rs. 20
      const response1 = await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({ fruitId: 'orange-001', quantity: 1 });

      expect(response1.body.cart.totalPrice).toBe(20);

      // Add another orange - should be Rs. 40
      const response2 = await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({ fruitId: 'orange-001', quantity: 1 });

      expect(response2.body.cart.totalPrice).toBe(40);
    });
  });

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.service).toBe('cart-service');
    });
  });

  // ============================================================
  // OFFER CALCULATION TESTS
  // ============================================================

  describe('Buy 1 Get 1 Free Offer (Apple @ Rs. 10)', () => {
    // Apples have Buy 1 Get 1 Free offer
    // 1 apple -> pay for 1 = Rs. 10
    // 2 apples -> pay for 1 = Rs. 10 (1 free)
    // 3 apples -> pay for 2 = Rs. 20 (1 free)
    // 4 apples -> pay for 2 = Rs. 20 (2 free)
    // 5 apples -> pay for 3 = Rs. 30 (2 free)

    it('should charge Rs. 10 for 1 apple', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({ fruitId: 'apple-offer', quantity: 1 });

      expect(response.body.cart.finalPrice).toBe(10);
      expect(response.body.cart.items[0].quantity).toBe(1);
      expect(response.body.cart.items[0].freeItems).toBe(0);
    });

    it('should charge Rs. 10 for 2 apples (1 paid + 1 free)', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({ fruitId: 'apple-offer', quantity: 2 });

      expect(response.body.cart.finalPrice).toBe(10);
      expect(response.body.cart.items[0].quantity).toBe(1);
      expect(response.body.cart.items[0].freeItems).toBe(1);
    });

    it('should charge Rs. 20 for 3 apples (2 paid + 1 free)', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({ fruitId: 'apple-offer', quantity: 3 });

      expect(response.body.cart.finalPrice).toBe(20);
      expect(response.body.cart.items[0].quantity).toBe(2);
      expect(response.body.cart.items[0].freeItems).toBe(1);
    });

    it('should charge Rs. 20 for 4 apples (2 paid + 2 free)', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({ fruitId: 'apple-offer', quantity: 4 });

      expect(response.body.cart.finalPrice).toBe(20);
      expect(response.body.cart.items[0].quantity).toBe(2);
      expect(response.body.cart.items[0].freeItems).toBe(2);
    });

    it('should charge Rs. 30 for 5 apples (3 paid + 2 free)', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({ fruitId: 'apple-offer', quantity: 5 });

      expect(response.body.cart.finalPrice).toBe(30);
      expect(response.body.cart.items[0].quantity).toBe(3);
      expect(response.body.cart.items[0].freeItems).toBe(2);
    });
  });

  describe('Buy 2 Get 3 Free Offer (Orange @ Rs. 20)', () => {
    // Oranges have Buy 2 Get 3 Free offer
    // 1 orange -> pay for 1 = Rs. 20
    // 2 oranges -> pay for 2 = Rs. 40
    // 3 oranges -> pay for 2 = Rs. 40 (1 free)
    // 4 oranges -> pay for 2 = Rs. 40 (2 free)
    // 5 oranges -> pay for 2 = Rs. 40 (3 free)
    // 6 oranges -> pay for 3 = Rs. 60 (3 free)
    // 7-10 oranges -> pay for 3 = Rs. 60
    // 11 oranges -> pay for 4 = Rs. 80

    it('should charge Rs. 40 for 5 oranges (2 paid + 3 free)', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({ fruitId: 'orange-offer', quantity: 5 });

      expect(response.body.cart.finalPrice).toBe(40);
      expect(response.body.cart.items[0].quantity).toBe(2);
      expect(response.body.cart.items[0].freeItems).toBe(3);
    });

    it('should charge Rs. 60 for 6 oranges (3 paid + 3 free)', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({ fruitId: 'orange-offer', quantity: 6 });

      expect(response.body.cart.finalPrice).toBe(60);
      expect(response.body.cart.items[0].quantity).toBe(3);
      expect(response.body.cart.items[0].freeItems).toBe(3);
    });

    it('should charge Rs. 60 for 7 oranges (3 paid + 4 free)', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({ fruitId: 'orange-offer', quantity: 7 });

      expect(response.body.cart.finalPrice).toBe(60);
      expect(response.body.cart.items[0].quantity).toBe(3);
      expect(response.body.cart.items[0].freeItems).toBe(4);
    });

    it('should charge Rs. 60 for 8 oranges (3 paid + 5 free)', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({ fruitId: 'orange-offer', quantity: 8 });

      expect(response.body.cart.finalPrice).toBe(60);
      expect(response.body.cart.items[0].quantity).toBe(3);
      expect(response.body.cart.items[0].freeItems).toBe(5);
    });

    it('should charge Rs. 60 for 9 oranges (3 paid + 6 free)', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({ fruitId: 'orange-offer', quantity: 9 });

      expect(response.body.cart.finalPrice).toBe(60);
      expect(response.body.cart.items[0].quantity).toBe(3);
      expect(response.body.cart.items[0].freeItems).toBe(6);
    });

    it('should charge Rs. 60 for 10 oranges (3 paid + 7 free)', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({ fruitId: 'orange-offer', quantity: 10 });

      expect(response.body.cart.finalPrice).toBe(60);
      expect(response.body.cart.items[0].quantity).toBe(3);
      expect(response.body.cart.items[0].freeItems).toBe(7);
    });

    it('should charge Rs. 80 for 11 oranges (4 paid + 7 free)', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({ fruitId: 'orange-offer', quantity: 11 });

      expect(response.body.cart.finalPrice).toBe(80);
      expect(response.body.cart.items[0].quantity).toBe(4);
      expect(response.body.cart.items[0].freeItems).toBe(7);
    });
  });

  describe('Buy 3 Get 5 Free Offer (Mango @ Rs. 30)', () => {
    // Mangoes have Buy 3 Get 5 Free offer
    // 1 mango -> pay for 1 = Rs. 30
    // 2 mangoes -> pay for 2 = Rs. 60
    // 3 mangoes -> pay for 3 = Rs. 90
    // 4-8 mangoes -> pay for 3 = Rs. 90 (rest free)
    // 9-16 mangoes -> pay for 4 = Rs. 120 (rest free)
    // 17-24 mangoes -> pay for 5 = Rs. 150

    it('should charge Rs. 90 for 3 mangoes (3 paid + 0 free)', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({ fruitId: 'mango-offer', quantity: 3 });

      expect(response.body.cart.finalPrice).toBe(90);
      expect(response.body.cart.items[0].quantity).toBe(3);
      expect(response.body.cart.items[0].freeItems).toBe(0);
    });

    it('should charge Rs. 90 for 8 mangoes (3 paid + 5 free)', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({ fruitId: 'mango-offer', quantity: 8 });

      expect(response.body.cart.finalPrice).toBe(90);
      expect(response.body.cart.items[0].quantity).toBe(3);
      expect(response.body.cart.items[0].freeItems).toBe(5);
    });

    it('should charge Rs. 120 for 9 mangoes (4 paid + 5 free)', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({ fruitId: 'mango-offer', quantity: 9 });

      expect(response.body.cart.finalPrice).toBe(120);
      expect(response.body.cart.items[0].quantity).toBe(4);
      expect(response.body.cart.items[0].freeItems).toBe(5);
    });

    it('should charge Rs. 120 for 16 mangoes (4 paid + 12 free)', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({ fruitId: 'mango-offer', quantity: 16 });

      expect(response.body.cart.finalPrice).toBe(120);
      expect(response.body.cart.items[0].quantity).toBe(4);
      expect(response.body.cart.items[0].freeItems).toBe(12);
    });

    it('should charge Rs. 150 for 17 mangoes (5 paid + 12 free)', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({ fruitId: 'mango-offer', quantity: 17 });

      expect(response.body.cart.finalPrice).toBe(150);
      expect(response.body.cart.items[0].quantity).toBe(5);
      expect(response.body.cart.items[0].freeItems).toBe(12);
    });
  });

  describe('No offer scenario', () => {
    it('should charge full price for apples without offer', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({ fruitId: 'apple-001', quantity: 5 });

      expect(response.body.cart.finalPrice).toBe(50); // 5 * Rs. 10
      expect(response.body.cart.items[0].quantity).toBe(5);
      expect(response.body.cart.items[0].freeItems).toBe(0);
    });

    it('should charge full price for oranges without offer', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({ fruitId: 'orange-001', quantity: 5 });

      expect(response.body.cart.finalPrice).toBe(100); // 5 * Rs. 20
      expect(response.body.cart.items[0].quantity).toBe(5);
      expect(response.body.cart.items[0].freeItems).toBe(0);
    });
  });

  describe('POST /api/cart/checkout', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', testToken)
        .send({ fruitId: 'apple-001', quantity: 2 });
      
      mockedAxios.get.mockClear();
      mockedAxios.post.mockClear();
    });

    it('should checkout successfully with CREDIT_CARD', async () => {
      const response = await request(app)
        .post('/api/cart/checkout')
        .set('Authorization', testToken)
        .send({ paymentMethod: 'CREDIT_CARD', notes: 'Leave at front door' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.transaction.paymentMethod).toBe('CREDIT_CARD');
      expect(response.body.transaction.finalAmount).toBe(20);
    });

    it('should checkout successfully with WALLET', async () => {
      // Mock auth-service responses
      mockedAxios.get.mockResolvedValueOnce({ data: { user: { walletBalance: 100 } } });
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } }); // deduct-balance
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } }); // notify-order

      const response = await request(app)
        .post('/api/cart/checkout')
        .set('Authorization', testToken)
        .send({ paymentMethod: 'WALLET' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.transaction.paymentMethod).toBe('WALLET');
    });

    it('should return 400 for insufficient wallet balance', async () => {
      // Mock auth-service responses - only 10 Rs in wallet, but order is 20
      mockedAxios.get.mockResolvedValueOnce({ data: { user: { walletBalance: 10 } } });

      const response = await request(app)
        .post('/api/cart/checkout')
        .set('Authorization', testToken)
        .send({ paymentMethod: 'WALLET' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Insufficient');
    });
  });
});

