import http from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { assertDatabaseConnection } from './db/db.js';
import { logger } from './lib/logger.js';
import { connectRedis } from './lib/redis.js';
import { initIo } from './realtime/io.js';

async function bootstrap() {
  try {
    await assertDatabaseConnection();
    await connectRedis();

    const app = createApp();
    const server = http.createServer(app);
    const port = Number(env.PORT) || 5000;

    await initIo(server);

    server.listen(port, () => {
      logger.info(`Server is now listening on port ${port}`);
    });
  } catch (err) {
    logger.error(`Failed to start the server: ${(err as Error).message}`);
    process.exit(1);
  }
}

bootstrap();
