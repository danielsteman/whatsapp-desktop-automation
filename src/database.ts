// @ts-ignore
import { Database } from "jsr:@db/sqlite@0.12.0";

export interface Message {
  id: string;
  chatId: string;
  authorId: string;
  authorName: string;
  body: string;
  timestamp: number;
  isGroup: boolean;
  groupName?: string;
  messageType: string;
  embedding?: number[];
  isAiGenerated?: boolean;
}

export class DatabaseService {
  private db: Database;

  constructor(dbPath: string = "whatsapp.db") {
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    // Create messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        author_id TEXT NOT NULL,
        author_name TEXT,
        body TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        is_group BOOLEAN DEFAULT FALSE,
        group_name TEXT,
        message_type TEXT DEFAULT 'text',
        embedding BLOB,
        is_ai_generated BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create chats table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        name TEXT,
        is_group BOOLEAN DEFAULT FALSE,
        last_message_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index for vector similarity search
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_chat_timestamp
      ON messages(chat_id, timestamp DESC)
    `);

    console.log("Database initialized successfully");
  }

  async storeMessage(message: Message): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO messages
      (id, chat_id, author_id, author_name, body, timestamp, is_group, group_name, message_type, embedding, is_ai_generated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      message.id,
      message.chatId,
      message.authorId,
      message.authorName,
      message.body,
      message.timestamp,
      message.isGroup ? 1 : 0,
      message.groupName || null,
      message.messageType,
      message.embedding ? new Uint8Array(message.embedding) : null,
      message.isAiGenerated ? 1 : 0,
    ]);
  }

  async storeChat(
    chatId: string,
    name: string,
    isGroup: boolean
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO chats (id, name, is_group, last_message_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `);
    stmt.run([chatId, name, isGroup ? 1 : 0]);
  }

  async getMessagesForContext(
    chatId: string,
    limit: number = 20
  ): Promise<Message[]> {
    const stmt = this.db.prepare(`
      SELECT id, chat_id, author_id, author_name, body, timestamp, is_group, group_name, message_type
      FROM messages
      WHERE chat_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all([chatId, limit]) as any[];

    return rows.map((row) => ({
      id: row.id,
      chatId: row.chat_id,
      authorId: row.author_id,
      authorName: row.author_name,
      body: row.body,
      timestamp: row.timestamp,
      isGroup: row.is_group === 1,
      groupName: row.group_name,
      messageType: row.message_type,
    }));
  }

  async searchSimilarMessages(
    query: string,
    chatId?: string,
    limit: number = 10
  ): Promise<Message[]> {
    let stmt;

    if (chatId) {
      stmt = this.db.prepare(`
        SELECT id, chat_id, author_id, author_name, body, timestamp, is_group, group_name, message_type
        FROM messages
        WHERE chat_id = ? AND body LIKE ?
        ORDER BY timestamp DESC
        LIMIT ?
      `);
      var rows = stmt.all([chatId, `%${query}%`, limit]) as any[];
    } else {
      stmt = this.db.prepare(`
        SELECT id, chat_id, author_id, author_name, body, timestamp, is_group, group_name, message_type
        FROM messages
        WHERE body LIKE ?
        ORDER BY timestamp DESC
        LIMIT ?
      `);
      var rows = stmt.all([`%${query}%`, limit]) as any[];
    }

    return rows.map((row) => ({
      id: row.id,
      chatId: row.chat_id,
      authorId: row.author_id,
      authorName: row.author_name,
      body: row.body,
      timestamp: row.timestamp,
      isGroup: row.is_group === 1,
      groupName: row.group_name,
      messageType: row.message_type,
    }));
  }

  async updateMessageEmbedding(
    messageId: string,
    embedding: number[]
  ): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE messages SET embedding = ? WHERE id = ?
    `);
    stmt.run([new Uint8Array(embedding), messageId]);
  }

  close(): void {
    this.db.close();
  }
}
