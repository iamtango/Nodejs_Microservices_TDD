import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cartRoutes from './routes/cartRoutes';
import fruitRoutes from './routes/fruitRoutes';
import { authMiddleware, mockAuthMiddleware } from './middleware/authMiddleware';
import cookieParser from 'cookie-parser';

import dotenv from 'dotenv';
import connectDB from './utils/connectDB';
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Health check endpoint (no auth required)
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy', service: 'cart-service' });
});

// Use mock auth middleware for testing, real auth for production
const authMiddlewareToUse = process.env.NODE_ENV === 'test' 
  ? mockAuthMiddleware 
  : authMiddleware;

// Public fruit routes (no auth required for viewing)
app.use('/api/fruits', fruitRoutes);

// Protected cart routes
app.use('/api/cart', authMiddlewareToUse, cartRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
});

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
   connectDB().then(() => {
   app.listen(PORT, () => {
    console.log(`🛒 Cart Service running on port ${PORT}`);
  });
  }).catch((error) => {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  });
}

export default app;
