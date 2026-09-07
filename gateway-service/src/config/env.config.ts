import Joi from 'joi';

export const envSchema = Joi.object({
  GATEWAY_SERVICE_PORT: Joi.number().default(3000),
  GATEWAY_SERVICE_NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  POSTGRES_HOST: Joi.string().required(),
  POSTGRES_PORT: Joi.number().default(5432),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string().required(),
  POSTGRES_DB: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
});