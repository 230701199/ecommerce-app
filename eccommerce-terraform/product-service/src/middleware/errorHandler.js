function errorHandler(err, req, res, next) {
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  const payload = { error: { message: err.message || 'Internal Server Error' } };
  if (process.env.NODE_ENV !== 'production') payload.error.stack = err.stack;
  res.status(statusCode).json(payload);
}

module.exports = { errorHandler };

