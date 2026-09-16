import Joi from 'joi';

// Shared .env (Compose + Nest). Extra OS keys are ignored (Nest allowUnknown).
// Empty S3 / Gemini / LlamaParse strings let Nest boot; those features fail later if unset.
export const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),

  POSTGRES_HOST: Joi.string().required(),
  POSTGRES_PORT: Joi.number().default(5432),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string().required(),
  POSTGRES_DB: Joi.string().required(),
  DATABASE_URL: Joi.string().uri().allow('').default(''),

  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),

  API_KEY: Joi.string().min(1).required(),
  AI_WORKER_HOST: Joi.string().default('0.0.0.0'),
  AI_WORKER_PORT: Joi.number().default(8000),
  AI_WORKER_ALLOWED_HOSTS: Joi.string().default('localhost,127.0.0.1,ai-worker,gateway-service'),
  LLAMA_PARSE_API_KEY: Joi.string().allow('').default(''),
  GEMINI_CONTENT_EMBEDDING_API_KEY: Joi.string().allow('').default(''),
  GEMINI_QUERY_EMBEDDING_API_KEY: Joi.string().allow('').default(''),
  GEMINI_EMBEDDING_MODEL: Joi.string().default('gemini-embedding-001'),
  GEMINI_CONTENT_GENERATE_API_KEY: Joi.string().allow('').default(''),
  GEMINI_GENERATIVE_MODEL: Joi.string().default('gemini-2.5-flash'),

  GATEWAY_SERVICE_PORT: Joi.number().default(3000),
  GATEWAY_SERVICE_CORS_ORIGIN: Joi.string().default('*'),
  JWT_SECRET: Joi.string().min(32).required(),
  DOCUMENT_SERVICE_URL: Joi.string().uri().required(),

  S3_BUCKET: Joi.string().allow('').required(),
  S3_REGION: Joi.string().allow('').required(),
  S3_ACCESS_KEY_ID: Joi.string().allow('').required(),
  S3_SECRET_ACCESS_KEY: Joi.string().allow('').required(),
  S3_ENDPOINT: Joi.string().uri().allow('').required(),
}).unknown(true);
