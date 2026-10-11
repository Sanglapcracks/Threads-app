import { query } from '../../db/db.js';
import { getIo } from '../../realtime/io.js';
import { mapNotificationsRow, NotificationRow } from './notifications.types.js';

type NotificationType = 'REPLY_ON_THREAD' | 'LIKE_ON_THREAD';

async function createNotification(
  type: NotificationType,
  threadId: number,
  actorUserId: number
) {
  const threadRes = await query<{ author_user_id: number }>(
    `SELECT author_user_id FROM threads WHERE id = $1 LIMIT 1`,
    [threadId]
  );

  const row = threadRes.rows[0];
  if (!row) return;

  const authorUserId = row.author_user_id;
  if (authorUserId === actorUserId) return;

  const insertSql =
    type === 'LIKE_ON_THREAD'
      ? `INSERT INTO notifications (user_id, actor_user_id, thread_id, type)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, actor_user_id, thread_id) WHERE type = 'LIKE_ON_THREAD'
         DO NOTHING
         RETURNING id`
      : `INSERT INTO notifications (user_id, actor_user_id, thread_id, type)
         VALUES ($1, $2, $3, $4)
         RETURNING id`;

  const insertRes = await query<{ id: number }>(insertSql, [
    authorUserId,
    actorUserId,
    threadId,
    type,
  ]);

  const notiRow = insertRes.rows[0];
  if (!notiRow) return; // duplicate like: nothing to send

  const fullRes = await query<NotificationRow>(
    `SELECT
       n.id,
       n.type,
       n.thread_id,
       n.created_at,
       n.read_at,
       actor.display_name AS actor_display_name,
       actor.handle AS actor_handle,
       t.title AS thread_title
     FROM notifications n
     JOIN users actor ON actor.id = n.actor_user_id
     JOIN threads t ON t.id = n.thread_id
     WHERE n.id = $1
     LIMIT 1`,
    [notiRow.id]
  );

  const fullRow = fullRes.rows[0];
  if (!fullRow) return;

  const payload = mapNotificationsRow(fullRow);

  getIo()
    ?.to(`notifications:user:${authorUserId}`)
    .emit('notification:new', payload);
}

export function createReplyNotification(params: {
  threadId: number;
  actorUserId: number;
}) {
  return createNotification('REPLY_ON_THREAD', params.threadId, params.actorUserId);
}

export function createLikeNotification(params: {
  threadId: number;
  actorUserId: number;
}) {
  return createNotification('LIKE_ON_THREAD', params.threadId, params.actorUserId);
}

export async function listNotificationsForUser(params: {
  userId: number;
  unreadOnly: boolean;
}) {
  const { unreadOnly, userId } = params;

  const conditions = ['n.user_id = $1'];
  const values: unknown[] = [userId];

  if (unreadOnly) {
    conditions.push('n.read_at IS NULL');
  }

  const result = await query(
    `SELECT
       n.id,
       n.type,
       n.thread_id,
       n.created_at,
       n.read_at,
       actor.display_name AS actor_display_name,
       actor.handle AS actor_handle,
       t.title AS thread_title
     FROM notifications n
     JOIN users actor ON actor.id = n.actor_user_id
     JOIN threads t ON t.id = n.thread_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY n.created_at DESC`,
    values
  );

  return result.rows.map((noti) => mapNotificationsRow(noti as NotificationRow));
}

export async function markNotificationRead(params: {
  userId: number;
  notificationId: number;
}) {
  const { userId, notificationId } = params;

  await query(
    `UPDATE notifications
     SET read_at = COALESCE(read_at, NOW())
     WHERE id = $1 AND user_id = $2`,
    [notificationId, userId]
  );
}

export async function markAllNotificationsRead(userId: number) {
  await query(
    `UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`,
    [userId]
  );
}