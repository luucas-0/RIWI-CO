BEGIN;

SET LOCAL app.current_user_id = '11111111-1111-4111-8111-111111111111';
SELECT * FROM rw_channels;
SELECT * FROM rw_messages WHERE rw_channel_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

ROLLBACK;
