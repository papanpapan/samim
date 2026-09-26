import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET must be at least 8 characters'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().default(12),
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  /** Swagger UI at /api/docs. Off in production unless explicitly true. */
  ENABLE_API_DOCS: z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined || v === '') return undefined;
      return v === '1' || v.toLowerCase() === 'true';
    }),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@sabanursery.com'),
  SEED_ADMIN_PASSWORD: z.string().min(6).default('Admin@12345'),
});

const parsed = envSchema.superRefine((data, ctx) => {
  const placeholder = data.JWT_SECRET === 'change-me-in-production' || data.JWT_SECRET.length < 24;
  if (data.NODE_ENV === 'production' && placeholder) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['JWT_SECRET'],
      message: 'Production JWT_SECRET must be a unique secret of at least 24 characters',
    });
  }
}).safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Environment validation failed. See logs above.');
}

const data = parsed.data;
export const env = {
  ...data,
  ENABLE_API_DOCS: data.ENABLE_API_DOCS ?? data.NODE_ENV !== 'production',
};
export type Env = typeof env;
