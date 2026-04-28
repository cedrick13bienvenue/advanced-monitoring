'use strict';

require('./tracing');

const app = require('./app');

const PORT = parseInt(process.env.PORT || '3000', 10);

app.listen(PORT, () => {
  const logger = require('./logger');
  logger.info('server started', { port: PORT, env: process.env.NODE_ENV });
});
