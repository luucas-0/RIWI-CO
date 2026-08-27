BEGIN;
SET LOCAL ROLE rw_app;
SELECT set_config('app.current_user_id', '33333333-3333-4333-8333-333333333333', true);
DO $$
DECLARE visible_channels integer; visible_messages integer;
BEGIN
  SELECT count(*) INTO visible_channels FROM rw_channels;
  SELECT count(*) INTO visible_messages FROM rw_messages;
  IF visible_channels <> 1 OR visible_messages <> 1 THEN RAISE EXCEPTION 'RLS isolation failed: channels %, messages %', visible_channels, visible_messages; END IF;
END $$;
ROLLBACK;
