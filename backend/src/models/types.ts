/**
 * Represents a user in the database.
 */
export interface User {
  id: number;
  email: string;
  created_at: number;
}

/**
 * Represents an API Key in the database.
 */
export interface ApiKey {
  id: number;
  user_id: number;
  name: string | null;
  key_hash: string;
  created_at: number;
}

/**
 * Represents a conversation object for synchronization.
 */
export interface Conversation {
  id: string; // UUID from client
  user_id: number;
  name: string;
  updated_at: number;
  is_deleted: 0 | 1;
}

/**
 * Represents a message object for synchronization.
 */
export interface Message {
  id: string; // UUID from client
  user_id: number;
  conversation_id: string;
  content: string;
  updated_at: number;
  is_deleted: 0 | 1;
}

/**
 * The structure of the request body for the /sync endpoint.
 */
export interface SyncRequestBody {
  last_sync_timestamp: number;
  client_changes: {
    conversations: Conversation[];
    messages: Message[];
  };
}

/**
 * The structure of the response from the /sync endpoint.
 */
export interface SyncResponseBody {
  server_changes: {
    conversations: Conversation[];
    messages: Message[];
  };
  new_sync_timestamp: number;
}
