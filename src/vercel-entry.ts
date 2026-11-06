import { getRequestListener } from '@hono/node-server';
import app from './app';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default getRequestListener(app.fetch);
