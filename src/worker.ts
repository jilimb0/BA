import { app } from './server.js';

export default {
  /**
   * Serverless entry point for Cloudflare Workers / Edge Runtime
   */
  fetch: app.fetch,
};
