CREATE UNIQUE INDEX IF NOT EXISTS uniq_like_notification
  ON notifications (user_id, actor_user_id, thread_id)
  WHERE type = 'LIKE_ON_THREAD';