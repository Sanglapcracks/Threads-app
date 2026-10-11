import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.string().default('5000'),
  NODE_ENV: z.string().default('development'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().default('6450'),
  DB_NAME: z.string().default('realtime_chat_and_threads_app'),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('postgres'),
  DB_SSL: z.enum(['true', 'false']).default('false'),
  CLERK_PUBLISHABLE_KEY: z.string(),
  CLERK_SECRET_KEY: z.string(),
  CLOUDINARY_CLOUD_NAME: z.string(),
  CLOUDINARY_API_KEY: z.string(),
  CLOUDINARY_API_SECRET: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6380'),
  CORS_ORIGINS: z.string().default('http://localhost:4000'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    'Invalid environment variables:',
    parsed.error.issues.map((i) => i.path.join('.') + ': ' + i.message)
  );
  process.exit(1);
}

export const env = parsed.data;
export const allowedOrigins = env.CORS_ORIGINS.split(',').map((s) => s.trim());