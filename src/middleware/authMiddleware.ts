import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { AuthUser } from '../types';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = "Bearer "+req.cookies.token;
  if (!authHeader) {
    res.status(401).json({ success: false, message: 'No authorization header provided' });
    return;
  }

  try {
    // Verify token with auth service
    const response = await axios.get(`${AUTH_SERVICE_URL}/api/auth/verify`, {
      headers: { Authorization: authHeader }
    });

    if (response.data.valid) {
      req.user = {
        userId: response.data.userId,
        email: response.data.email
      };
      next();
    } else {
      res.status(401).json({ success: false, message: 'Invalid token' });
    }
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      res.status(error.response.status).json({
        success: false,
        message: error.response.data.message || 'Authentication failed'
      });
    } else {
      res.status(503).json({
        success: false,
        message: 'Authentication service unavailable'
      });
    }
  }
};

// Mock auth middleware for testing (bypasses external auth service call)
export const mockAuthMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ success: false, message: 'No authorization header provided' });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({ success: false, message: 'Invalid authorization header format' });
    return;
  }

  // For testing: extract userId from test token format "test-user-{userId}"
  const token = parts[1];
  if (token.startsWith('test-user-')) {
    const userId = token.replace('test-user-', '');
    req.user = {
      userId,
      email: `${userId}@test.com`
    };
    next();
  } else {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};
