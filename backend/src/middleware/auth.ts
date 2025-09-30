import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { DatabaseService } from '../services/database';
import { User } from '../models/types';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

// Extend the Express Request type to include the user payload
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
  };
}

/**
 * Middleware to authenticate requests using a JSON Web Token (JWT).
 * Used for the web UI where a user is logged in.
 */
export const jwtAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res
      .status(401)
      .json({ message: 'Authentication token is required.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
    req.user = { userId: payload.userId };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

/**
 * Middleware to authenticate requests using an API Key.
 * Used for client applications performing synchronization.
 */
export const apiKeyAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'API key is required.' });
  }

  const apiKey = authHeader.split(' ')[1];
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  try {
    const keyRecord = await DatabaseService.get<{ user_id: number }>(
      'SELECT user_id FROM api_keys WHERE key_hash = ?',
      [keyHash]
    );

    if (!keyRecord) {
      return res.status(401).json({ message: 'Invalid API key.' });
    }

    req.user = { userId: keyRecord.user_id };
    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    return res
      .status(500)
      .json({ message: 'Internal server error during authentication.' });
  }
};
