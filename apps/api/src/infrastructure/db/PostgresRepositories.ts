import { PoolClient } from 'pg';
import { ChannelRepository, MessageRepository } from '../../domain/repositories.js';
import { Channel, Message } from '../../domain/entities.js';

const messageColumns = 'rw_id, rw_channel_id, rw_sender_user_id, rw_content, rw_status, rw_created_at, rw_updated_at, rw_deleted_at';

export class PostgresChannelRepository implements ChannelRepository {
  constructor(private readonly client: PoolClient) {}

  async listForUser(userId: string): Promise<Channel[]> {
    return (await this.client.query<Channel>(`SELECT c.*
      FROM rw_channels c
      WHERE c.rw_deleted_at IS NULL
        AND EXISTS (
          SELECT 1
          FROM rw_channel_members cm
          WHERE cm.rw_channel_id = c.rw_id
            AND cm.rw_user_id = $1
            AND cm.rw_deleted_at IS NULL
        )
      ORDER BY c.rw_name`, [userId])).rows;
  }

  async isMember(userId: string, channelId: string): Promise<boolean> {
    return ((await this.client.query(
      `SELECT 1
       FROM rw_channel_members
       WHERE rw_channel_id = $1
         AND rw_user_id = $2
         AND rw_deleted_at IS NULL
       LIMIT 1`,
      [channelId, userId],
    )).rowCount ?? 0) > 0;
  }

  async getById(channelId: string): Promise<Channel | null> {
    return (await this.client.query<Channel>('SELECT * FROM rw_channels WHERE rw_id = $1 AND rw_deleted_at IS NULL', [channelId])).rows[0] || null;
  }
}

export class PostgresMessageRepository implements MessageRepository {
  constructor(private readonly client: PoolClient) {}

  async listByChannel(channelId: string, cursor?: { rw_created_at: Date; rw_id: string }, limit = 25): Promise<Message[]> {
    const values: unknown[] = [channelId, limit];
    const clause = cursor ? ` AND (rw_created_at, rw_id) < ($3, $4)` : '';
    if (cursor) values.push(cursor.rw_created_at, cursor.rw_id);
    return (await this.client.query<Message>(`SELECT ${messageColumns}
      FROM rw_messages
      WHERE rw_channel_id = $1
        AND rw_deleted_at IS NULL
        AND EXISTS (
          SELECT 1
          FROM rw_channel_members cm
          WHERE cm.rw_channel_id = rw_messages.rw_channel_id
            AND cm.rw_user_id = current_setting('app.current_user_id', true)::uuid
            AND cm.rw_deleted_at IS NULL
        )
        ${clause}
      ORDER BY rw_created_at DESC, rw_id DESC
      LIMIT $2`, values)).rows;
  }

  async search(channelId: string, q: string, cursor?: { rw_created_at: Date; rw_id: string }, limit = 25): Promise<Message[]> {
    const values: unknown[] = [channelId, q, limit];
    const clause = cursor ? ` AND (rw_created_at, rw_id) < ($4, $5)` : '';
    if (cursor) values.push(cursor.rw_created_at, cursor.rw_id);
    return (await this.client.query<Message>(`SELECT ${messageColumns}
      FROM rw_messages
      WHERE rw_channel_id = $1
        AND rw_deleted_at IS NULL
        AND EXISTS (
          SELECT 1
          FROM rw_channel_members cm
          WHERE cm.rw_channel_id = rw_messages.rw_channel_id
            AND cm.rw_user_id = current_setting('app.current_user_id', true)::uuid
            AND cm.rw_deleted_at IS NULL
        )
        AND to_tsvector('simple', rw_content) @@ plainto_tsquery('simple', $2)
        ${clause}
      ORDER BY rw_created_at DESC, rw_id DESC
      LIMIT $3`, values)).rows;
  }

  async save(message: Partial<Message>): Promise<Message> {
    return (await this.client.query<Message>(`INSERT INTO rw_messages (${messageColumns})
      VALUES ($1,$2,$3,$4,$5,now(),now(),NULL)
      RETURNING ${messageColumns}`,
      [message.rw_id, message.rw_channel_id, message.rw_sender_user_id, message.rw_content, message.rw_status])).rows[0];
  }

  async softDelete(messageId: string, _userId: string): Promise<boolean> {
    return ((await this.client.query('UPDATE rw_messages SET rw_deleted_at = now() WHERE rw_id = $1', [messageId])).rowCount ?? 0) > 0;
  }
}
