import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

// This is a workaround for sql-cipher which is not properly typed for ES modules
// We use a dynamic require here.
const sqlcipher = require('sql-cipher');

export class DatabaseService {
  private static db: any;

  /**
   * Initializes the database connection and creates tables if they don't exist.
   * This method must be called before any other database operations.
   */
  public static async init() {
    if (this.db) {
      return;
    }

    const dbPath = process.env.DATABASE_PATH || './database.db';
    const encryptionKey = process.env.DATABASE_ENCRYPTION_KEY;

    if (!encryptionKey) {
      throw new Error(
        'DATABASE_ENCRYPTION_KEY is not set in environment variables.'
      );
    }

    // Open the database with the custom sql-cipher driver
    this.db = await open({
      filename: dbPath,
      driver: sqlcipher.Database,
    });

    // Set the encryption key for the database
    await this.db.run('PRAGMA key = ?', encryptionKey);

    // Improve performance and reliability
    await this.db.run('PRAGMA journal_mode = WAL;');
    await this.db.run('PRAGMA foreign_keys = ON;');

    console.log('Connected to the encrypted SQLite database.');

    await this.createTables();
  }

  /**
   * Executes a query that is expected to return a single row.
   * @param sql The SQL query string.
   * @param params Parameters to bind to the query.
   * @returns A single result object or undefined.
   */
  public static get<T>(
    sql: string,
    params: any[] = []
  ): Promise<T | undefined> {
    return this.db.get(sql, params);
  }

  /**
   * Executes a query that is expected to return multiple rows.
   * @param sql The SQL query string.
   * @param params Parameters to bind to the query.
   * @returns An array of result objects.
   */
  public static all<T>(sql: string, params: any[] = []): Promise<T[]> {
    return this.db.all(sql, params);
  }

  /**
   * Executes a query that does not return rows (e.g., INSERT, UPDATE, DELETE).
   * @param sql The SQL query string.
   * @param params Parameters to bind to the query.
   * @returns An object with lastID and changes.
   */
  public static run(
    sql: string,
    params: any[] = []
  ): Promise<{ lastID: number; changes: number }> {
    return this.db.run(sql, params);
  }

  /**
   * Executes a series of SQL statements within a transaction.
   * If any statement fails, the entire transaction is rolled back.
   * @param queries An array of { sql, params } objects.
   */
  public static async transaction(
    queries: { sql: string; params: any[] }[]
  ): Promise<void> {
    try {
      await this.db.run('BEGIN TRANSACTION;');
      for (const { sql, params } of queries) {
        await this.db.run(sql, params);
      }
      await this.db.run('COMMIT;');
    } catch (error) {
      await this.db.run('ROLLBACK;');
      console.error('Transaction failed, rolled back.', error);
      throw error;
    }
  }

  /**
   * Defines the database schema and creates tables if they don't exist.
   */
  private static async createTables() {
    const createUsersTable = `
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                created_at INTEGER NOT NULL
            );
        `;
    const createOtpsTable = `
            CREATE TABLE IF NOT EXISTS otps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                otp_hash TEXT NOT NULL,
                expires_at INTEGER NOT NULL
            );
        `;
    const createApiKeysTable = `
            CREATE TABLE IF NOT EXISTS api_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT,
                key_hash TEXT UNIQUE NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        `;
    const createConversationsTable = `
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY, -- Client-generated UUID
                user_id INTEGER NOT NULL,
                name TEXT,
                updated_at INTEGER NOT NULL,
                is_deleted INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        `;
    const createMessagesTable = `
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY, -- Client-generated UUID
                user_id INTEGER NOT NULL,
                conversation_id TEXT NOT NULL,
                content TEXT,
                updated_at INTEGER NOT NULL,
                is_deleted INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
            );
        `;

    await this.db.exec(createUsersTable);
    await this.db.exec(createOtpsTable);
    await this.db.exec(createApiKeysTable);
    await this.db.exec(createConversationsTable);
    await this.db.exec(createMessagesTable);

    console.log('Tables created or already exist.');
  }
}
