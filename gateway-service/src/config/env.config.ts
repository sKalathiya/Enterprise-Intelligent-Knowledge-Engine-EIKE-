import Joi from 'joi';

// Fail boot if required secrets/hosts are missing. S3 is optional here so the process can start;
// presign/complete will fail later if those fields are empty.
export const envSchema = Joi.object({
  GATEWAY_SERVICE_PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  POSTGRES_HOST: Joi.string().required(),
  POSTGRES_PORT: Joi.number().default(5432),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string().required(),
  POSTGRES_DB: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_HOST: Joi.string().required(),
  // Shared with FastAPI as X-Internal-Api-Key. Never sent by the browser.
  API_KEY: Joi.string().required(),
  GATEWAY_SERVICE_CORS_ORIGIN: Joi.string().default('*'),
  JWT_SECRET: Joi.string().min(32).required(),
  // Prefix of the query worker, e.g. http://ai-worker:8000/api/v1/ai
  DOCUMENT_SERVICE_URL: Joi.string().uri().required(),
  S3_BUCKET: Joi.string().allow('').required(),
  S3_REGION: Joi.string().allow('').required(),
  S3_ACCESS_KEY_ID: Joi.string().allow('').required(),
  S3_SECRET_ACCESS_KEY: Joi.string().allow('').required(),
  S3_ENDPOINT: Joi.string().allow('').required(), // empty = AWS; set only for MinIO
});