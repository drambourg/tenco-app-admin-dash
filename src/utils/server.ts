// src/utils/server.ts - Cloud Run optimized

import bodyParser from 'body-parser';
import express from 'express';

import routes from '../routes';
import { SERVER } from '../routes/routes.const';
import authMiddleware from '../services/utils/auth-middleware';

/**
 * Configure Express application for Cloud Run
 */
export function createApp(): express.Application {
  const app = express();

  // Trust proxy (important for Cloud Run)
  app.set('trust proxy', true);

  // Middleware
  app.use(bodyParser.json({ limit: SERVER.BODY_LIMIT }));
  app.use(bodyParser.urlencoded({ extended: true, limit: SERVER.BODY_LIMIT }));

  // Security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Health check endpoint (required for Cloud Run)
  app.get('/health', (req, res) => {
    res.status(200).json({
      environment: process.env.NODE_ENV,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
    });
  });

  // Readiness check endpoint
  app.get('/ready', (req, res) => {
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  });

  app.use(authMiddleware);

  // Application routes
  app.use(routes);

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.originalUrl} not found`,
      timestamp: new Date().toISOString(),
    });
  });

  // Error handler
  app.use(
    (
      error: any,
      req: express.Request,
      res: express.Response,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      next: express.NextFunction
    ) => {
      console.error('❌ Application error:', error);

      res.status(error.status || 500).json({
        error: 'Internal Server Error',
        message:
          process.env.NODE_ENV === 'development'
            ? error.message
            : 'Something went wrong',
        timestamp: new Date().toISOString(),
      });
    }
  );

  return app;
}

/**
 * Get server port with Cloud Run compatibility
 */
export function getServerPort(): number {
  // Cloud Run provides PORT environment variable
  const port = process.env.PORT || SERVER.DEV_PORT || 8080;
  return parseInt(port.toString(), 10);
}
