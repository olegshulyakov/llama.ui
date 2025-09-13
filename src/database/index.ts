// Conversations are stored in IndexedDB via Dexie.
// Format (conceptual): { [convId]: { id: string, lastModified: number, messages: [...] } }

import Dexie, { Table } from 'dexie';
import toast from 'react-hot-toast';
import { CONFIG_DEFAULT, isDev } from '../config';
import {
  Configuration,
  ConfigurationPreset,
  Conversation,
  ExportJsonStructure,
  Message,
  TimingReport,
} from '../types';

// --- Event Handling ---

/**
 * Event target for internal communication about conversation changes.
 */
const event = new EventTarget();

/**
 * Type for callback functions triggered on conversation change.
 */
type CallbackConversationChanged = (convId: string) => void;

/**
 * Stores registered event listeners to allow for removal.
 */
const onConversationChangedHandlers: [
  CallbackConversationChanged,
  EventListener,
][] = [];

/**
 * Dispatches a custom event indicating a conversation has changed.
 * @param convId The ID of the conversation that changed.
 */
const dispatchConversationChange = (convId: string) => {
  event.dispatchEvent(
    new CustomEvent<string>('conversationChange', { detail: convId })
  );
};

// --- Dexie Database Setup ---

/**
 * Dexie database instance for the application.
 */
const db = new Dexie('LlamacppWebui') as Dexie & {
  conversations: Table<Conversation, string>;
  messages: Table<Message, number>;
  userConfigurations: Table<ConfigurationPreset, string>;
};

// Define database schema
// https://dexie.org/docs/Version/Version.stores()
db.version(1).stores({
  // Index conversations by 'id' (unique) and 'lastModified'
  conversations: '&id, lastModified',
  // Index messages by 'id' (unique), 'convId', composite key '[convId+id]', and 'timestamp'
  messages: '&id, convId, [convId+id], timestamp',
  // Index userConfigurations by 'id' (unique) and 'name'
  userConfigurations: '&id, name',
});

// --- Main Storage Utility Functions ---

/**
 * Utility functions for interacting with application data (conversations, messages, config).
 */
const StorageUtils = {
  /**
   * Retrieves all conversations, sorted by last modified date (descending).
   * @returns A promise resolving to an array of Conversation objects.
   */
  async getAllConversations(): Promise<Conversation[]> {
    await migrationLStoIDB().catch(console.error); // noop if already migrated
    return (await db.conversations.toArray()).sort(
      (a, b) => b.lastModified - a.lastModified
    );
  },

  /**
   * Retrieves a single conversation by its ID.
   * @param convId The ID of the conversation to retrieve.
   * @returns A promise resolving to the Conversation object or null if not found.
   */
  async getOneConversation(convId: string): Promise<Conversation | null> {
    return (await db.conversations.get(convId)) ?? null;
  },

  /**
   * Retrieves all messages belonging to a specific conversation.
   * @param convId The ID of the conversation.
   * @returns A promise resolving to an array of Message objects.
   */
  async getMessages(convId: string): Promise<Message[]> {
    return await db.messages.where('convId').equals(convId).toArray();
  },

  /**
   * Filters messages to represent the path from a given leaf node to the root.
   * @param msgs The array of messages to filter (typically from getMessages).
   * @param leafNodeId The ID of the leaf message node.
   * @param includeRoot Whether to include the root node in the result.
   * @returns A new array of messages representing the path from leaf to root (sorted by timestamp).
   *          If leafNodeId is not found, returns the path ending at the message with the latest timestamp.
   */
  filterByLeafNodeId(
    msgs: Readonly<Message[]>,
    leafNodeId: Message['id'],
    includeRoot: boolean
  ): Readonly<Message[]> {
    const res: Message[] = [];
    const nodeMap = new Map<Message['id'], Message>();
    for (const msg of msgs) {
      nodeMap.set(msg.id, msg);
    }

    let startNode: Message | undefined = nodeMap.get(leafNodeId);
    if (!startNode) {
      // If leaf node not found, find the message with the latest timestamp
      let latestTime = -1;
      for (const msg of msgs) {
        if (msg.timestamp > latestTime) {
          startNode = msg;
          latestTime = msg.timestamp;
        }
      }
    }

    // Traverse the path from the start node (found leaf or latest) up to the root
    let currNode: Message | undefined = startNode;
    while (currNode) {
      // Add node to result if it's not the root, or if it is the root and we want to include it
      if (
        currNode.type !== 'root' ||
        (currNode.type === 'root' && includeRoot)
      ) {
        res.push(currNode);
      }
      // Move to the parent node
      currNode = nodeMap.get(currNode.parent ?? -1);
    }

    // Sort the result by timestamp to ensure chronological order
    res.sort((a, b) => a.timestamp - b.timestamp);
    return res;
  },

  /**
   * Creates a new conversation with an initial root message.
   * @param name The name/title for the new conversation.
   * @returns A promise resolving to the newly created Conversation object.
   */
  async createConversation(name: string): Promise<Conversation> {
    const now = Date.now();
    const msgId = now;

    const conv: Conversation = {
      id: `conv-${now}`,
      lastModified: now,
      currNode: msgId,
      name,
    };

    await db.transaction('rw', db.conversations, db.messages, async () => {
      await db.conversations.add(conv);
      // Create the initial root node
      await db.messages.add({
        id: msgId,
        convId: conv.id,
        type: 'root',
        timestamp: now,
        role: 'system',
        content: '',
        parent: -1,
        children: [],
      });
    });

    dispatchConversationChange(conv.id);
    return conv;
  },

  /**
   * Creates a new conversation by branching from an existing message.
   * @param convId The ID of the conversation to branch.
   * @param msgId The ID of the message to branch from.
   * @returns A promise resolving to the newly created Conversation object.
   */
  async branchConversation(
    convId: Conversation['id'],
    msgId: Message['id']
  ): Promise<Conversation> {
    // Get the source conversation
    const conv = await this.getOneConversation(convId);
    if (!conv) {
      throw new Error(`Branch conversation is not found`);
    }

    // Get the path from root to the fork message
    const convMsgs = await this.getMessages(convId);
    if (!convMsgs.some((msg) => msg.id === msgId)) {
      throw new Error(`Branch message is not found in conversation`);
    }
    const currNodes = this.filterByLeafNodeId(convMsgs, msgId, true);

    // Create mapping from old message IDs to new message IDs
    const msgIdMap = new Map<Message['id'], Message['id']>();
    const now = Date.now();
    let currentId = now;
    for (const msg of currNodes) {
      msgIdMap.set(msg.id, currentId++);
    }

    // Create new conversation with fork source information
    const branchConvId = `conv-${now}`;
    const branchConv: Conversation = {
      id: branchConvId,
      lastModified: now,
      currNode: msgIdMap.get(msgId)!,
      name: `${conv.name} - Branched`,
    };

    await db.transaction('rw', db.conversations, db.messages, async () => {
      // Add the new conversation
      await db.conversations.add(branchConv);

      // Copy all messages from the path to the new conversation with new IDs
      for (const msg of currNodes) {
        const newParentId = msg.parent === -1 ? -1 : msgIdMap.get(msg.parent)!;
        const newChildren = msg.children
          .map((childId) => msgIdMap.get(childId))
          .filter((id): id is number => id !== undefined);

        await db.messages.add({
          ...msg,
          id: msgIdMap.get(msg.id)!,
          convId: branchConvId,
          parent: newParentId,
          children: newChildren,
        });
      }
    });

    dispatchConversationChange(branchConvId);
    return branchConv;
  },

  /**
   * Updates the name of an existing conversation.
   * @param convId The ID of the conversation to update.
   * @param name The new name for the conversation.
   * @returns A promise that resolves when the update is complete.
   */
  async updateConversationName(convId: string, name: string): Promise<void> {
    await db.conversations.update(convId, {
      name,
    });
    dispatchConversationChange(convId);
  },

  /**
   * Appends a new message to a conversation as a child of a specified parent node.
   * @param msg The message content to append (must have content).
   * @param parentNodeId The ID of the parent message node.
   * @returns A promise that resolves when the message is appended.
   * @throws Error if the conversation or parent message does not exist.
   */
  async appendMsg(
    msg: Exclude<Message, 'parent' | 'children'>,
    parentNodeId: Message['id']
  ): Promise<void> {
    // Early return if message content is null
    if (msg.content === null) return;

    const { convId } = msg;

    await db.transaction('rw', db.conversations, db.messages, async () => {
      // Fetch conversation and parent message within the transaction
      const conv = await StorageUtils.getOneConversation(convId);
      const parentMsg = await db.messages.get({ convId, id: parentNodeId });

      if (!conv) {
        throw new Error(`Conversation ${convId} does not exist`);
      }
      if (!parentMsg) {
        throw new Error(
          `Parent message ID ${parentNodeId} does not exist in conversation ${convId}`
        );
      }

      // Update conversation's lastModified and currNode
      await db.conversations.update(convId, {
        lastModified: Date.now(),
        currNode: msg.id,
      });

      // Update parent's children array
      await db.messages.update(parentNodeId, {
        children: [...parentMsg.children, msg.id],
      });

      // Add the new message
      await db.messages.add({
        ...msg,
        parent: parentNodeId,
        children: [],
      });
    });

    // Dispatch event after successful transaction
    dispatchConversationChange(convId);
  },

  /**
   * Removes a message and all its siblings.
   * @param msg The message to remove.
   * @returns A promise that resolves when the message is removed.
   */
  async deleteMessage(
    msg: Pick<Message, 'id' | 'convId' | 'parent' | 'children'>
  ) {
    const { convId, id: msgId, parent: parentId } = msg;

    // Check if conversation exists
    const conv = await this.getOneConversation(msg.convId);
    if (!conv) {
      throw new Error(`Conversation is not found`);
    }

    // Check if message exists
    const convMsgs = await this.getMessages(msg.convId);
    if (!convMsgs.some((msg) => msg.id === msgId)) {
      throw new Error(`Remove message is not found in conversation`);
    }

    // Create cache for quick lookup
    const searchCache = new Map<number, Message>();
    convMsgs.forEach((m) => searchCache.set(m.id, m));

    // Get the list of messages to delete
    const toDelete = new Set<number>();
    const queue = [msg.id];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (toDelete.has(id)) continue;

      toDelete.add(id);
      const msg = searchCache.get(id);
      if (msg && msg.children.length > 0) {
        queue.push(...msg.children);
      }
    }

    // Get the list of messages to update children
    const isValidChild = (id: number) =>
      !toDelete.has(id) && searchCache.has(id);
    const toUpdateChildren: { key: number; changes: { children: number[] } }[] =
      [];
    convMsgs.forEach((m) => {
      if (toDelete.has(m.id)) return;
      if (m.children.some((id) => !isValidChild(id))) {
        toUpdateChildren.push({
          key: m.id,
          changes: {
            children: m.children.filter(isValidChild),
          },
        });
      }
    });

    await db.transaction('rw', db.conversations, db.messages, async () => {
      // Update orphaned children array
      if (toUpdateChildren.length > 0) {
        await db.messages.bulkUpdate(toUpdateChildren);
      }

      // Delete messages
      await db.messages.bulkDelete(Array.from(toDelete));

      // Update conversation currNode
      if (toDelete.has(conv.currNode)) {
        await db.conversations.update(msg.convId, {
          lastModified: Date.now(),
          currNode: parentId,
        });
      }
    });
    dispatchConversationChange(convId);
  },

  /**
   * Removes a conversation and all its associated messages.
   * @param convId The ID of the conversation to remove.
   * @returns A promise that resolves when the conversation is removed.
   */
  async deleteConversation(convId: string): Promise<void> {
    await db.transaction('rw', db.conversations, db.messages, async () => {
      await db.conversations.delete(convId);
      await db.messages.where('convId').equals(convId).delete();
    });
    dispatchConversationChange(convId);
  },

  // --- Export / Import Functions ---

  /**
   * Exports all from the database.
   * @returns A promise resolving to a database records.
   */
  async exportDB(convId?: string): Promise<ExportJsonStructure> {
    try {
      const exportData = await db.transaction('r', db.tables, async () => {
        const data: ExportJsonStructure = [];
        for (const table of db.tables) {
          const rows = [];
          if (!convId) {
            rows.push(...(await table.toArray()));
          } else {
            if (table.name === 'conversations') {
              rows.push(await table.where('id').equals(convId).first());
            } else if (table.name === 'messages') {
              rows.push(
                ...(await table.where('convId').equals(convId).toArray())
              );
            }
          }
          if (isDev)
            console.debug(
              `Export - Fetched ${rows.length} rows from table '${table.name}'.`
            );
          data.push({ table: table.name, rows: rows });
        }
        return data;
      });
      console.info('Database export completed successfully.');
      toast.success('Database export completed.');
      if (isDev)
        exportData.forEach((tableData) => {
          console.debug(
            `Exported table '${tableData.table}' with ${tableData.rows.length} rows.`
          );
        });
      return exportData;
    } catch (error) {
      console.error('Error during database export:', error);
      toast.success('Database export failed.');
      throw error; // Re-throw to allow caller to handle
    }
  },

  /**
   * Import data into database.
   * @returns A promise that resolves when import is complete.
   */
  async importDB(data: ExportJsonStructure) {
    try {
      await db.transaction('rw', db.tables, async () => {
        for (const record of data) {
          console.debug(`Import - Processing table '${record.table}'...`);
          if (db.tables.some((t) => t.name === record.table)) {
            // Override existing rows if key exists.
            await db.table(record.table).bulkPut(record.rows);
            console.debug(
              `Import - Imported ${record.rows.length} rows into table '${record.table}'.`
            );
          } else {
            console.warn(`Import - Skipping unknown table '${record.table}'.`);
          }
        }

        // Dispatch change events for conversations that were imported/updated.
        const convRecords = data.filter(
          (r) => r.table === db.conversations.name
        );
        for (const record of convRecords) {
          for (const row of record.rows) {
            const convRow = row as Partial<Conversation>;
            if (convRow.id !== undefined) {
              dispatchConversationChange(convRow.id);
            } else {
              console.warn("Imported conversation row missing 'id':", row);
            }
          }
        }
      });
      console.info('Database import completed successfully.');
      toast.success('Database import completed.');
    } catch (error) {
      console.error('Error during database import:', error);
      toast.success('Database import failed.');
      throw error; // Re-throw to allow caller to handle
    }
  },

  // --- Event Listeners ---

  /**
   * Registers a callback to be invoked when a conversation changes.
   * @param callback The function to call when a conversation changes.
   */
  onConversationChanged(callback: CallbackConversationChanged) {
    const wrappedListener: EventListener = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      callback(customEvent.detail); // Pass the convId from the event detail
    };
    onConversationChangedHandlers.push([callback, wrappedListener]);
    event.addEventListener('conversationChange', wrappedListener);
  },

  /**
   * Unregisters a previously registered conversation change callback.
   * @param callback The function to unregister.
   */
  offConversationChanged(callback: CallbackConversationChanged) {
    const index = onConversationChangedHandlers.findIndex(
      ([cb, _]) => cb === callback
    );
    if (index !== -1) {
      const [_, wrappedListener] = onConversationChangedHandlers[index];
      event.removeEventListener('conversationChange', wrappedListener);
      onConversationChangedHandlers.splice(index, 1); // Remove the specific listener entry
    }
  },

  // --- Configuration Management (localStorage) ---

  /**
   * Retrieves the current application configuration.
   * Merges saved values with defaults to handle missing keys.
   * @returns The current Configuration object.
   */
  getConfig(): Configuration {
    const savedConfigString = localStorage.getItem('config');
    let savedVal: Partial<Configuration> = {};
    if (savedConfigString) {
      try {
        savedVal = JSON.parse(savedConfigString);
      } catch (e) {
        console.error('Failed to parse saved config from localStorage:', e);
        toast.error('Failed to parse saved config.');
      }
    }
    // Provide default values for any missing keys
    return {
      ...CONFIG_DEFAULT,
      ...savedVal,
    };
  },

  /**
   * Saves the application configuration to localStorage.
   * @param config The Configuration object to save.
   */
  setConfig(config: Configuration) {
    localStorage.setItem('config', JSON.stringify(config));
  },

  /**
   * Retrieves the currently selected UI theme.
   * @returns The theme string ('auto', 'light', 'dark', etc.) or 'auto' if not set.
   */
  getTheme(): string {
    return localStorage.getItem('theme') || 'auto';
  },

  /**
   * Saves the selected UI theme to localStorage.
   * If 'auto' is selected, the theme item is removed.
   * @param theme The theme string to save.
   */
  setTheme(theme: string) {
    if (theme === 'auto') {
      localStorage.removeItem('theme');
    } else {
      localStorage.setItem('theme', theme);
    }
  },

  /**
   * Retrieves the currently selected syntax theme.
   * @returns The theme string ('auto', etc.) or 'auto' if not set.
   */
  getSyntaxTheme(): string {
    return localStorage.getItem('syntaxTheme') || 'auto';
  },

  /**
   * Saves the selected syntax theme to localStorage.
   * If 'auto' is selected, the theme item is removed.
   * @param theme The theme string to save.
   */
  setSyntaxTheme(theme: string) {
    if (theme === 'auto') {
      localStorage.removeItem('syntaxTheme');
    } else {
      localStorage.setItem('syntaxTheme', theme);
    }
  },

  /**
   * Retrieves the user's configuration presets.
   * @returns The array of configuration preset.
   */
  async getPresets() {
    return db.transaction('r', db.userConfigurations, async () => {
      return db.userConfigurations.toArray();
    });
  },

  /**
   * Saves the user's configuration preset to localStorage, replacing the existing one.
   * @param name The preset name to save.
   * @param config The Configuration object to save.
   */
  async savePreset(name: string, config: Configuration, id?: string) {
    const now = Date.now();
    const newPreset: ConfigurationPreset = {
      id: id || `config-${now}`,
      name,
      createdAt: now,
      config,
    };
    await db.transaction('rw', db.userConfigurations, async () => {
      await db.userConfigurations.where('name').equals(name).delete();
      await db.userConfigurations.add(newPreset);
    });
    return newPreset;
  },

  /**
   * Removes the user's configuration preset.
   * @param name The preset name to remove.
   */
  async removePreset(name: string) {
    return db.transaction('rw', db.userConfigurations, async () => {
      return db.userConfigurations.where('name').equals(name).delete();
    });
  },
};

export default StorageUtils;

// --- Migration Logic (from localStorage to IndexedDB) ---

// these are old types, LS prefix stands for LocalStorage
interface LSConversation {
  id: string; // format: `conv-{timestamp}`
  lastModified: number; // timestamp from Date.now()
  messages: LSMessage[];
}
interface LSMessage {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timings?: TimingReport;
}

/**
 * Migrates conversation data from localStorage to IndexedDB.
 * Runs only once, indicated by the 'migratedToIDB' flag in localStorage.
 * @returns A promise that resolves when migration is complete or skipped.
 */
async function migrationLStoIDB() {
  const MIGRATION_FLAG_KEY = 'migratedToIDB';
  if (localStorage.getItem(MIGRATION_FLAG_KEY)) {
    return; // Already migrated
  }

  console.log('Starting migration from localStorage to IndexedDB...');
  const res: LSConversation[] = [];

  // Iterate through localStorage keys to find conversation data
  for (const key in localStorage) {
    if (key.startsWith('conv-')) {
      try {
        const item = localStorage.getItem(key);
        if (item) {
          const parsedItem: unknown = JSON.parse(item);
          res.push(parsedItem as LSConversation);
        }
      } catch (e) {
        console.warn(`Failed to parse localStorage item with key ${key}:`, e);
      }
    }
  }

  if (res.length === 0) {
    console.log('No legacy conversations found for migration.');
    return;
  }

  // Perform migration within a single transaction
  await db
    .transaction('rw', db.conversations, db.messages, async () => {
      let migratedCount = 0;
      for (const conv of res) {
        const { id: convId, lastModified, messages } = conv;

        // Validate legacy conversation structure
        if (messages.length < 2) {
          console.log(
            `Skipping conversation ${convId} with fewer than 2 messages.`
          );
          continue;
        }
        const firstMsg = messages[0];
        const lastMsg = messages[messages.length - 1];
        if (!firstMsg || !lastMsg) {
          console.log(
            `Skipping conversation ${convId} with ${messages.length} messages.`
          );
          continue;
        }

        const name = firstMsg.content || '(no messages)';

        // 1. Add the conversation record
        await db.conversations.add({
          id: convId,
          lastModified,
          currNode: lastMsg.id,
          name,
        });

        // 2. Create and add the root node
        const rootId = firstMsg.id - 2;
        await db.messages.add({
          id: rootId,
          convId: convId,
          type: 'root',
          timestamp: rootId,
          role: 'system',
          content: '',
          parent: -1,
          children: [firstMsg.id],
        });

        // 3. Add the legacy messages, linking them appropriately
        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          await db.messages.add({
            ...msg,
            type: 'text',
            convId: convId,
            timestamp: msg.id,
            parent: i === 0 ? rootId : messages[i - 1].id,
            children: i === messages.length - 1 ? [] : [messages[i + 1].id],
          });
        }

        migratedCount++;
        console.log(
          `Migrated conversation ${convId} with ${messages.length} messages.`
        );
      }
      console.log(
        `Migration complete. Migrated ${migratedCount} conversations from localStorage to IndexedDB.`
      );
    })
    .then(() => {
      // Mark migration as complete only after the transaction finishes successfully
      localStorage.setItem(MIGRATION_FLAG_KEY, '1');
    })
    .catch((error) => {
      console.error('Error during migration transaction:', error);
      toast.error('An error occurred during data migration.');
    });
}
