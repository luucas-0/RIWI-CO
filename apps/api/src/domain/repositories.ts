import { AiUsageRecord, Channel, ChannelMember, Message, User } from './entities.js';

export interface MessageRepository {
  listByChannel(channelId: string, cursor?: { rw_created_at: Date; rw_id: string }, limit?: number): Promise<Message[]>;
  search(channelId: string, q: string, cursor?: { rw_created_at: Date; rw_id: string }, limit?: number): Promise<Message[]>;
  save(message: Partial<Message>): Promise<Message>;
  softDelete(messageId: string, userId: string): Promise<boolean>;
}

export interface ChannelRepository {
  listForUser(userId: string): Promise<Channel[]>;
  isMember(userId: string, channelId: string): Promise<boolean>;
  getById(channelId: string): Promise<Channel | null>;
}

export interface UserRepository {
  getById(userId: string): Promise<User | null>;
}

export interface AiUsageRepository {
  aggregateByUser(userId: string): Promise<{ rw_user_id: string; rw_total_tokens: number; rw_total_cost_usd: number }[]>;
}

export interface AiProvider {
  embedText(input: string): Promise<number[]>;
  answerWithRag(options: { userId: string; channelIds: string[]; question: string; context: Array<{ rw_id: string; rw_content: string; rw_channel_id: string; rw_created_at: Date }> }): Promise<{ answer: string; citations: string[]; }>; 
}
