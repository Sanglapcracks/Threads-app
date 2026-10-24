import type { ConsumeMessage } from 'amqplib';
import { Emitter } from '@socket.io/redis-emitter';
import { connectRabbit, EXCHANGE } from '../lib/rabbit.js';
import { connectRedis, redis } from '../lib/redis.js';
import { assertDatabaseConnection } from '../db/db.js';
import { insertNotification } from '../modules/notifications/notification.service.js';
import { logger } from '../lib/logger.js';
import type { ThreadEvent } from '../events/types.js';

const QUEUE = 'notifications';
const RETRY_QUEUE = 'notifications.retry';
const PARKED_QUEUE = 'notifications.parked';
const DLX = 'threads.dlx';
const MAX_RETRIES = 5;

function deathCount(msg: ConsumeMessage): number {
  const deaths =
    (msg.properties.headers?.['x-death'] as
      | Array<{ queue: string; count: number }>
      | undefined) ?? [];
  return deaths
    .filter((d) => d.queue === QUEUE)
    .reduce((n, d) => n + Number(d.count), 0);
}

export async function startNotificationWorker() {
  await assertDatabaseConnection();
  await connectRedis();
  const ch = await connectRabbit();
  const emitter = new Emitter(redis);

  // Failed message path: main queue -> DLX -> retry queue (30s wait) -> back to the exchange
  await ch.assertExchange(DLX, 'topic', { durable: true });
  await ch.assertQueue(RETRY_QUEUE, {
    durable: true,
    arguments: {
      'x-message-ttl': 30000,
      'x-dead-letter-exchange': EXCHANGE,
    },
  });
  await ch.bindQueue(RETRY_QUEUE, DLX, 'thread.*');
  await ch.assertQueue(PARKED_QUEUE, { durable: true });
  await ch.assertQueue(QUEUE, {
    durable: true,
    arguments: { 'x-dead-letter-exchange': DLX },
  });
  await ch.bindQueue(QUEUE, EXCHANGE, 'thread.*');
  await ch.prefetch(10);

  await ch.consume(QUEUE, async (msg) => {
    if (!msg) return;
    try {
      const event = JSON.parse(msg.content.toString()) as ThreadEvent;
      const type =
        event.type === 'thread.liked' ? 'LIKE_ON_THREAD' : 'REPLY_ON_THREAD';

      const result = await insertNotification(
        type,
        event.threadId,
        event.actorUserId
      );

      if (result) {
        // JSON round trip so dates arrive as strings, like they do today
        const payload = JSON.parse(JSON.stringify(result.payload));
        emitter
          .to(`notifications:user:${result.recipientUserId}`)
          .emit('notification:new', payload);
      }
      ch.ack(msg);
    } catch (err) {
      logger.error(`Notification job failed: ${(err as Error).message}`);
      if (deathCount(msg) >= MAX_RETRIES) {
        ch.sendToQueue(PARKED_QUEUE, msg.content, { persistent: true });
        ch.ack(msg);
      } else {
        ch.nack(msg, false, false);
      }
    }
  });

  logger.info('Notification worker is consuming');
}