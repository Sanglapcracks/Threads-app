import { startNotificationWorker } from './notification.worker.js';
import { logger } from '../lib/logger.js';

startNotificationWorker().catch((err) => {
  logger.error(`Worker failed to start: ${(err as Error).message}`);
  process.exit(1);
});