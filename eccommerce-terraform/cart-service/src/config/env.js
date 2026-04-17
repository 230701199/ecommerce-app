const dotenv = require('dotenv');

dotenv.config();

function getEnv(name, { required = true, defaultValue } = {}) {
  const value = process.env[name];
  if (value == null || value === '') {
    if (required) throw new Error(`Missing required env var: ${name}`);
    return defaultValue;
  }
  return value;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3001),
  awsRegion: getEnv('AWS_REGION', { required: true }),
  cartTable: getEnv('CART_TABLE', { required: true }),
  dynamodbEndpoint: process.env.DYNAMODB_ENDPOINT || undefined,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 300)
};

module.exports = { env };

