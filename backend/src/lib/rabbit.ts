import amqplib from 'amqplib';
import type { ConfirmChannel } from 'amqplib';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from './logger.js';

export const EXCHANGE = 'threads.events';

let channel: ConfirmChannel | null = null;

export async function connectRabbit(): Promise<ConfirmChannel> {
  if (channel) return channel;

  const connection = await amqplib.connect(env.RABBITMQ_URL);
  connection.on('error', (e: Error) => logger.error(`RabbitMQ error: ${e.message}`));
  connection.on('close', () => {
    channel = null;
    logger.warn('RabbitMQ connection closed');
  });

  const ch = await connection.createConfirmChannel();
  await ch.assertExchange(EXCHANGE, 'topic', { durable: true });
  channel = ch;
  return ch;
}

export async function publishEvent(routingKey: string, payload: object) {
  const ch = await connectRabbit();
  await new Promise<void>((resolve, reject) => {
    ch.publish(
      EXCHANGE,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      {
        persistent: true,
        contentType: 'application/json',
        messageId: randomUUID(),
      },
      (err) => (err ? reject(err) : resolve())
    );
  });
}