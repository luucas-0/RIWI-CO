BEGIN;
SET LOCAL ROLE rw_app;
SELECT set_config('app.current_user_id', '11111111-1111-4111-8111-111111111111', true);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM rw_messages WHERE rw_channel_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') THEN RAISE EXCEPTION 'RLS leaked messages from a foreign channel'; END IF;
  BEGIN
    INSERT INTO rw_messages (rw_id,rw_channel_id,rw_sender_user_id,rw_content,rw_status) VALUES ('99999999-9999-4999-8999-999999999999','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','forbidden','sent');
    RAISE EXCEPTION 'RLS accepted an unauthorized write';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
ROLLBACK;
