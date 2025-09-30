import { Router, Response } from 'express';
import crypto from 'crypto';
import { jwtAuth, AuthenticatedRequest } from '../middleware/auth';
import { DatabaseService } from '../services/database';
import { ApiKey } from '../models/types';

const router = Router();

// All routes in this file are protected and require a valid JWT.
router.use(jwtAuth);

// GET /api/keys
// Fetches a list of API keys for the authenticated user.
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  try {
    const keys = await DatabaseService.all<ApiKey>(
      'SELECT id, name, created_at FROM api_keys WHERE user_id = ?',
      [userId]
    );
    res.status(200).json(keys);
  } catch (error) {
    console.error('Failed to fetch API keys:', error);
    res.status(500).json({ message: 'Failed to fetch API keys.' });
  }
});

// POST /api/keys
// Generates a new API key for the authenticated user.
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const { name } = req.body;

  try {
    // Generate a high-entropy API key
    const apiKey = crypto.randomBytes(32).toString('hex');

    // Store a hash of the key, not the key itself.
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    await DatabaseService.run(
      'INSERT INTO api_keys (user_id, name, key_hash, created_at) VALUES (?, ?, ?, ?)',
      [userId, name || null, keyHash, Date.now()]
    );

    // IMPORTANT: This is the only time the raw API key is sent to the client.
    // The client must save it immediately.
    res.status(201).json({ message: 'API key created successfully.', apiKey });
  } catch (error) {
    console.error('Failed to create API key:', error);
    res.status(500).json({ message: 'Failed to create API key.' });
  }
});

// DELETE /api/keys/:id
// Revokes an existing API key.
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const { id } = req.params;

  try {
    const result = await DatabaseService.run(
      'DELETE FROM api_keys WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (result.changes === 0) {
      return res.status(404).json({
        message:
          'API key not found or you do not have permission to delete it.',
      });
    }

    res.status(200).json({ message: 'API key revoked successfully.' });
  } catch (error) {
    console.error('Failed to revoke API key:', error);
    res.status(500).json({ message: 'Failed to revoke API key.' });
  }
});

export default router;
