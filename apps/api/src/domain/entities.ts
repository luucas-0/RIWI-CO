export type UserRole = 'admin' | 'member';
export type MessageStatus = 'pending' | 'sent' | 'failed';

export interface User {
  rw_id: string;
  rw_name: string;
  rw_email: string;
  rw_role: UserRole;
  rw_created_at: Date;
  rw_updated_at: Date;
  rw_deleted_at?: Date | null;
}

export interface Channel {
  rw_id: string;
  rw_name: string;
  rw_owner_user_id: string;
  rw_created_at: Date;
  rw_updated_at: Date;
  rw_deleted_at?: Date | null;
}

export interface ChannelMember {
  rw_id: string;
  rw_channel_id: string;
  rw_user_id: string;
  rw_joined_at: Date;
  rw_deleted_at?: Date | null;
}

export interface Message {
  rw_id: string;
  rw_channel_id: string;
  rw_sender_user_id: string;
  rw_content: string;
  rw_status: MessageStatus;
  rw_created_at: Date;
  rw_updated_at: Date;
  rw_deleted_at?: Date | null;
  rw_embedding?: number[] | null;
}

export interface AiUsageRecord {
  rw_id: string;
  rw_user_id: string;
  rw_channel_id: string;
  rw_prompt_version: string;
  rw_tokens_input: number;
  rw_tokens_output: number;
  rw_total_tokens: number;
  rw_cost_usd: number;
  rw_created_at: Date;
}
