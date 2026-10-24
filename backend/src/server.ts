import http from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { assertDatabaseConnection, pool } from './db/db.js';
import { logger } from './lib/logger.js';
import { connectRedis, redis } from './lib/redis.js';
import { initIo } from './realtime/io.js';
import { connectRabbit } from './lib/rabbit.js';

async function bootstrap() {
  try {
    await assertDatabaseConnection();
    await connectRedis();
        connectRabbit().catch((e) =>
      logger.error(`RabbitMQ unavailable: ${(e as Error).message}`)
    );

    const app = createApp();
    const server = http.createServer(app);
    const port = Number(env.PORT) || 5000;

    const io = await initIo(server);

    server.listen(port, () => {
      logger.info(`Server is now listening on port ${port}`);
    });

    let shuttingDown = false;
    const shutdown = async (signal: string) => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.info(`${signal} received, shutting down`);
      setTimeout(() => process.exit(1), 10_000).unref();
      try {
        await new Promise<void>((resolve) => io.close(() => resolve()));
        await pool.end();
        await redis.quit();
        process.exit(0);
      } catch (err) {
        logger.error(`Shutdown error: ${(err as Error).message}`);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
  } catch (err) {
    logger.error(`Failed to start the server: ${(err as Error).message}`);
    process.exit(1);
  }
}

bootstrap();