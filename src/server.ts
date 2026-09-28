import app from './app';
import config from './config/config';

const PORT = config.port;

Bun.serve({
  port: PORT,
  hostname: '0.0.0.0',
  fetch: app.fetch,
});

console.log(`Server running at http://0.0.0.0:${PORT}`);
