// src/utils/server.ts
import http from 'http';

import bodyParser from 'body-parser';
import express from 'express';

import routes from '../routes';
import { SERVER } from '../routes/routes.const';

/**
 * Configure l'application Express
 */
export function createApp(): express.Application {
  const app = express();

  // Middleware global
  app.use(bodyParser.json({ limit: SERVER.BODY_LIMIT }));

  // Routes de l'application
  app.use(routes);

  return app;
}

/**
 * Crée et configure le serveur HTTP
 */
export function createServer(app: express.Application): http.Server {
  return http.createServer(app);
}

/**
 * Détermine le port à utiliser en fonction de l'environnement
 */
export function getServerPort(): number {
  if (process.env.NODE_ENV === 'development' || !process.env.K_SERVICE) {
    return SERVER.DEV_PORT;
  }
  return parseInt(process.env.PORT || String(SERVER.DEFAULT_PORT), 10);
}
