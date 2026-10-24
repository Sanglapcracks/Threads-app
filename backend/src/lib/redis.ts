import { createClient } from 'redis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

export const redis = createClient({ url: env.REDIS_URL });
redis.on('error', (e) => logger.error(`Redis error: ${e.message}`));

export async function connectRedis() {
  if (!redis.isOpen) await redis.connect();
}