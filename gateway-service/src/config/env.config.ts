import Joi from 'joi';

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
  API_KEY: Joi.string().required(),
  GATEWAY_SERVICE_CORS_ORIGIN: Joi.string().default('*'),
  JWT_SECRET: Joi.string().min(32).required(),
  SHARED_UPLOAD: Joi.string().required(),
  DOCUMENT_SERVICE_URL: Joi.string().uri().required(),
});