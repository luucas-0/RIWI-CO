CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rw_users (rw_id uuid PRIMARY KEY, rw_name text NOT NULL, rw_email text NOT NULL UNIQUE, rw_password_hash text NOT NULL, rw_role text NOT NULL CHECK (rw_role IN ('admin','member')), rw_created_at timestamptz NOT NULL DEFAULT now(), rw_updated_at timestamptz NOT NULL DEFAULT now(), rw_deleted_at timestamptz);
CREATE TABLE IF NOT EXISTS rw_channels (rw_id uuid PRIMARY KEY, rw_name text NOT NULL CHECK (length(trim(rw_name)) > 0), rw_owner_user_id uuid NOT NULL REFERENCES rw_users(rw_id) ON DELETE RESTRICT, rw_created_at timestamptz NOT NULL DEFAULT now(), rw_updated_at timestamptz NOT NULL DEFAULT now(), rw_deleted_at timestamptz);
CREATE TABLE IF NOT EXISTS rw_channel_members (rw_id uuid PRIMARY KEY, rw_channel_id uuid NOT NULL REFERENCES rw_channels(rw_id) ON DELETE CASCADE, rw_user_id uuid NOT NULL REFERENCES rw_users(rw_id) ON DELETE CASCADE, rw_joined_at timestamptz NOT NULL DEFAULT now(), rw_deleted_at timestamptz, UNIQUE (rw_channel_id, rw_user_id));
CREATE TABLE IF NOT EXISTS rw_messages (rw_id uuid PRIMARY KEY, rw_channel_id uuid NOT NULL REFERENCES rw_channels(rw_id) ON DELETE CASCADE, rw_sender_user_id uuid NOT NULL REFERENCES rw_users(rw_id) ON DELETE RESTRICT, rw_content text NOT NULL CHECK (length(trim(rw_content)) > 0), rw_status text NOT NULL CHECK (rw_status IN ('pending','sent','failed')), rw_created_at timestamptz NOT NULL DEFAULT now(), rw_updated_at timestamptz NOT NULL DEFAULT now(), rw_deleted_at timestamptz, rw_embedding vector(1536));
CREATE TABLE IF NOT EXISTS rw_message_reads (rw_id uuid PRIMARY KEY, rw_message_id uuid NOT NULL REFERENCES rw_messages(rw_id) ON DELETE CASCADE, rw_user_id uuid NOT NULL REFERENCES rw_users(rw_id) ON DELETE CASCADE, rw_read_at timestamptz NOT NULL DEFAULT now(), UNIQUE(rw_message_id,rw_user_id));
CREATE TABLE IF NOT EXISTS rw_ai_usage (rw_id uuid PRIMARY KEY, rw_user_id uuid NOT NULL REFERENCES rw_users(rw_id) ON DELETE CASCADE, rw_channel_id uuid NOT NULL REFERENCES rw_channels(rw_id) ON DELETE CASCADE, rw_prompt_version text NOT NULL, rw_tokens_input integer NOT NULL CHECK(rw_tokens_input>=0), rw_tokens_output integer NOT NULL CHECK(rw_tokens_output>=0), rw_total_tokens integer NOT NULL CHECK(rw_total_tokens>=0), rw_cost_usd numeric(12,6) NOT NULL CHECK(rw_cost_usd>=0), rw_created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS rw_refresh_tokens (rw_id uuid PRIMARY KEY, rw_user_id uuid NOT NULL REFERENCES rw_users(rw_id) ON DELETE CASCADE, rw_token_hash text NOT NULL, rw_expires_at timestamptz NOT NULL, rw_revoked_at timestamptz, rw_created_at timestamptz NOT NULL DEFAULT now());

CREATE INDEX IF NOT EXISTS idx_rw_messages_channel_created ON rw_messages (rw_channel_id,rw_created_at DESC,rw_id DESC);
CREATE INDEX IF NOT EXISTS idx_rw_messages_embedding ON rw_messages USING hnsw (rw_embedding vector_cosine_ops);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rw_active_member ON rw_channel_members(rw_channel_id,rw_user_id) WHERE rw_deleted_at IS NULL;

CREATE OR REPLACE FUNCTION rw_touch_and_clear_embedding() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.rw_updated_at=now(); IF TG_TABLE_NAME='rw_messages' AND NEW.rw_content IS DISTINCT FROM OLD.rw_content THEN NEW.rw_embedding=NULL; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS rw_messages_touch ON rw_messages;
CREATE TRIGGER rw_messages_touch BEFORE UPDATE ON rw_messages FOR EACH ROW EXECUTE FUNCTION rw_touch_and_clear_embedding();
DROP TRIGGER IF EXISTS rw_channels_touch ON rw_channels;
CREATE TRIGGER rw_channels_touch BEFORE UPDATE ON rw_channels FOR EACH ROW EXECUTE FUNCTION rw_touch_and_clear_embedding();

ALTER TABLE rw_channels ENABLE ROW LEVEL SECURITY; ALTER TABLE rw_channels FORCE ROW LEVEL SECURITY;
ALTER TABLE rw_messages ENABLE ROW LEVEL SECURITY; ALTER TABLE rw_messages FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rw_channels_select ON rw_channels; CREATE POLICY rw_channels_select ON rw_channels FOR SELECT USING (rw_deleted_at IS NULL AND (rw_owner_user_id = nullif(current_setting('app.current_user_id',true),'')::uuid OR EXISTS (SELECT 1 FROM rw_channel_members cm WHERE cm.rw_channel_id=rw_channels.rw_id AND cm.rw_user_id=nullif(current_setting('app.current_user_id',true),'')::uuid AND cm.rw_deleted_at IS NULL)));
DROP POLICY IF EXISTS rw_messages_select ON rw_messages; CREATE POLICY rw_messages_select ON rw_messages FOR SELECT USING (rw_deleted_at IS NULL AND EXISTS (SELECT 1 FROM rw_channel_members cm WHERE cm.rw_channel_id=rw_messages.rw_channel_id AND cm.rw_user_id=nullif(current_setting('app.current_user_id',true),'')::uuid AND cm.rw_deleted_at IS NULL));
DROP POLICY IF EXISTS rw_messages_insert ON rw_messages; CREATE POLICY rw_messages_insert ON rw_messages FOR INSERT WITH CHECK (rw_sender_user_id=nullif(current_setting('app.current_user_id',true),'')::uuid AND EXISTS (SELECT 1 FROM rw_channel_members cm WHERE cm.rw_channel_id=rw_messages.rw_channel_id AND cm.rw_user_id=rw_sender_user_id AND cm.rw_deleted_at IS NULL));
DROP POLICY IF EXISTS rw_messages_update ON rw_messages; CREATE POLICY rw_messages_update ON rw_messages FOR UPDATE USING (rw_sender_user_id=nullif(current_setting('app.current_user_id',true),'')::uuid) WITH CHECK (rw_sender_user_id=nullif(current_setting('app.current_user_id',true),'')::uuid);

CREATE OR REPLACE VIEW rw_user_conversations WITH (security_invoker=true) AS SELECT c.rw_id AS rw_channel_id,c.rw_name,max(m.rw_created_at) AS rw_last_message_at FROM rw_channels c LEFT JOIN rw_messages m ON m.rw_channel_id=c.rw_id GROUP BY c.rw_id,c.rw_name;
CREATE OR REPLACE FUNCTION rw_find_users(p_term text) RETURNS SETOF rw_users LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT * FROM rw_users WHERE rw_deleted_at IS NULL AND (rw_name ILIKE '%'||p_term||'%' OR rw_email ILIKE '%'||p_term||'%') ORDER BY rw_name $$;
CREATE OR REPLACE PROCEDURE rw_update_or_soft_delete_user(p_user_id uuid,p_name text DEFAULT NULL,p_delete boolean DEFAULT false) LANGUAGE plpgsql AS $$ BEGIN UPDATE rw_users SET rw_name=COALESCE(p_name,rw_name),rw_deleted_at=CASE WHEN p_delete THEN now() ELSE rw_deleted_at END,rw_updated_at=now() WHERE rw_id=p_user_id; END $$;

DO $$ BEGIN CREATE ROLE rw_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD 'rw_app'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT USAGE ON SCHEMA public TO rw_app;
GRANT SELECT,INSERT,UPDATE ON rw_users,rw_refresh_tokens,rw_ai_usage TO rw_app;
GRANT SELECT ON rw_channels,rw_channel_members,rw_messages,rw_message_reads TO rw_app;
GRANT INSERT,UPDATE ON rw_messages TO rw_app;
