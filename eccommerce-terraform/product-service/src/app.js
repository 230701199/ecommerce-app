const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { productRoutes } = require('./routes/productRoutes');
const { notFound } = require('./middleware/notFound');
const { errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN === '*' || !process.env.CORS_ORIGIN ? true : process.env.CORS_ORIGIN }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));

  app.use(
    rateLimit({
      windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
      limit: Number(process.env.RATE_LIMIT_MAX || 300),
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.use(productRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };

