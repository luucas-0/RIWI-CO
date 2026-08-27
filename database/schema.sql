CREATE EXTENSION IF NOT EXISTS pgvector;

CREATE TABLE IF NOT EXISTS rw_users (
  rw_id UUID PRIMARY KEY,
  rw_name TEXT NOT NULL,
  rw_email TEXT NOT NULL UNIQUE,
  rw_password_hash TEXT NOT NULL,
  rw_role TEXT NOT NULL CHECK (rw_role IN ('admin', 'member')),
  rw_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rw_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rw_deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS rw_channels (
  rw_id UUID PRIMARY KEY,
  rw_name TEXT NOT NULL CHECK (length(rw_name) > 0),
  rw_owner_user_id UUID NOT NULL REFERENCES rw_users(rw_id) ON DELETE RESTRICT,
  rw_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rw_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rw_deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS rw_channel_members (
  rw_id UUID PRIMARY KEY,
  rw_channel_id UUID NOT NULL REFERENCES rw_channels(rw_id) ON DELETE CASCADE,
  rw_user_id UUID NOT NULL REFERENCES rw_users(rw_id) ON DELETE CASCADE,
  rw_joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rw_deleted_at TIMESTAMPTZ NULL,
  UNIQUE (rw_channel_id, rw_user_id)
);

CREATE TABLE IF NOT EXISTS rw_messages (
  rw_id UUID PRIMARY KEY,
  rw_channel_id UUID NOT NULL REFERENCES rw_channels(rw_id) ON DELETE CASCADE,
  rw_sender_user_id UUID NOT NULL REFERENCES rw_users(rw_id) ON DELETE RESTRICT,
  rw_content TEXT NOT NULL,
  rw_status TEXT NOT NULL CHECK (rw_status IN ('pending', 'sent', 'failed')),
  rw_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rw_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rw_deleted_at TIMESTAMPTZ NULL,
  rw_embedding vector(1536)
);

CREATE TABLE IF NOT EXISTS rw_message_reads (
  rw_id UUID PRIMARY KEY,
  rw_message_id UUID NOT NULL REFERENCES rw_messages(rw_id) ON DELETE CASCADE,
  rw_user_id UUID NOT NULL REFERENCES rw_users(rw_id) ON DELETE CASCADE,
  rw_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rw_message_id, rw_user_id)
);

CREATE TABLE IF NOT EXISTS rw_ai_usage (
  rw_id UUID PRIMARY KEY,
  rw_user_id UUID NOT NULL REFERENCES rw_users(rw_id) ON DELETE CASCADE,
  rw_channel_id UUID NOT NULL REFERENCES rw_channels(rw_id) ON DELETE CASCADE,
  rw_prompt_version TEXT NOT NULL,
  rw_tokens_input INTEGER NOT NULL CHECK (rw_tokens_input >= 0),
  rw_tokens_output INTEGER NOT NULL CHECK (rw_tokens_output >= 0),
  rw_total_tokens INTEGER NOT NULL CHECK (rw_total_tokens >= 0),
  rw_cost_usd NUMERIC(12,6) NOT NULL CHECK (rw_cost_usd >= 0),
  rw_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rw_messages_channel_created ON rw_messages (rw_channel_id, rw_created_at DESC, rw_id DESC);
CREATE INDEX IF NOT EXISTS idx_rw_messages_channel_deleted ON rw_messages (rw_channel_id, rw_deleted_at);
CREATE INDEX IF NOT EXISTS idx_rw_message_reads_message ON rw_message_reads (rw_message_id);
CREATE INDEX IF NOT EXISTS idx_rw_channels_owner ON rw_channels (rw_owner_user_id);
CREATE INDEX IF NOT EXISTS idx_rw_messages_embedding ON rw_messages USING hnsw (rw_embedding vector_cosine_ops);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rw_messages_active_unique
ON rw_messages (rw_id)
WHERE rw_deleted_at IS NULL;

ALTER TABLE rw_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE rw_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY rw_channels_select_policy ON rw_channels
FOR SELECT
USING (
  rw_id IN (
    SELECT rw_channel_id FROM rw_channel_members WHERE rw_user_id = current_setting('app.current_user_id', true)::uuid
  )
  OR rw_owner_user_id = current_setting('app.current_user_id', true)::uuid
);

CREATE POLICY rw_channels_insert_policy ON rw_channels
FOR INSERT
WITH CHECK (rw_owner_user_id = current_setting('app.current_user_id', true)::uuid);

CREATE POLICY rw_messages_select_policy ON rw_messages
FOR SELECT
USING (
  rw_deleted_at IS NULL AND rw_channel_id IN (
    SELECT rw_channel_id FROM rw_channel_members WHERE rw_user_id = current_setting('app.current_user_id', true)::uuid
  )
);

CREATE POLICY rw_messages_update_policy ON rw_messages
FOR UPDATE
USING (
  rw_sender_user_id = current_setting('app.current_user_id', true)::uuid
)
WITH CHECK (
  rw_sender_user_id = current_setting('app.current_user_id', true)::uuid
);

CREATE POLICY rw_messages_insert_policy ON rw_messages
FOR INSERT
WITH CHECK (
  rw_sender_user_id = current_setting('app.current_user_id', true)::uuid AND
  rw_channel_id IN (
    SELECT rw_channel_id FROM rw_channel_members WHERE rw_user_id = current_setting('app.current_user_id', true)::uuid
  )
);

CREATE FUNCTION rw_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.rw_updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rw_channels_updated_at
BEFORE UPDATE ON rw_channels
FOR EACH ROW
EXECUTE FUNCTION rw_set_updated_at();

CREATE TRIGGER rw_messages_updated_at
BEFORE UPDATE ON rw_messages
FOR EACH ROW
EXECUTE FUNCTION rw_set_updated_at();
