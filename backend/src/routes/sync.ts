import { Router, Response } from 'express';
import { apiKeyAuth, AuthenticatedRequest } from '../middleware/auth';
import { DatabaseService } from '../services/database';
import {
  Conversation,
  Message,
  SyncRequestBody,
  SyncResponseBody,
} from '../models/types';

const router = Router();

// The sync endpoint is protected by API key authentication.
router.use(apiKeyAuth);

// POST /api/sync
// The main endpoint for delta-synchronization.
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const { last_sync_timestamp, client_changes } = req.body as SyncRequestBody;

  if (last_sync_timestamp === undefined || !client_changes) {
    return res.status(400).json({ message: 'Invalid sync request body.' });
  }

  const newSyncTimestamp = Date.now();

  try {
    // --- 1. Process client changes using Last-Write-Wins ---
    const transactionQueries = [];
    const clientConversations = client_changes.conversations || [];
    const clientMessages = client_changes.messages || [];

    for (const convo of clientConversations) {
      // Upsert logic for conversations
      const sql = `
                INSERT INTO conversations (id, user_id, name, updated_at, is_deleted)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    updated_at = excluded.updated_at,
                    is_deleted = excluded.is_deleted
                WHERE excluded.updated_at > conversations.updated_at;
            `;
      transactionQueries.push({
        sql,
        params: [
          convo.id,
          userId,
          convo.name,
          convo.updated_at,
          convo.is_deleted,
        ],
      });
    }

    for (const msg of clientMessages) {
      // Upsert logic for messages
      const sql = `
                INSERT INTO messages (id, user_id, conversation_id, content, updated_at, is_deleted)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    content = excluded.content,
                    updated_at = excluded.updated_at,
                    is_deleted = excluded.is_deleted
                WHERE excluded.updated_at > messages.updated_at;
            `;
      transactionQueries.push({
        sql,
        params: [
          msg.id,
          userId,
          msg.conversation_id,
          msg.content,
          msg.updated_at,
          msg.is_deleted,
        ],
      });
    }

    if (transactionQueries.length > 0) {
      await DatabaseService.transaction(transactionQueries);
    }

    // --- 2. Fetch server changes since the last sync ---
    const serverConversations = await DatabaseService.all<Conversation>(
      'SELECT * FROM conversations WHERE user_id = ? AND updated_at > ?',
      [userId, last_sync_timestamp]
    );

    const serverMessages = await DatabaseService.all<Message>(
      'SELECT * FROM messages WHERE user_id = ? AND updated_at > ?',
      [userId, last_sync_timestamp]
    );

    const response: SyncResponseBody = {
      server_changes: {
        conversations: serverConversations,
        messages: serverMessages,
      },
      new_sync_timestamp: newSyncTimestamp,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Sync failed:', error);
    res
      .status(500)
      .json({ message: 'An error occurred during synchronization.' });
  }
});

export default router;
