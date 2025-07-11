// src/utils/auth-middleware.ts
import { NextFunction, Request, Response } from 'express';

/**
 * Simple authentication middleware using basic auth
 */
function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip auth for health checks
  if (req.path === '/health' || req.path === '/ready') {
    return next();
  }

  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith('Basic ')) {
    return res.status(401).set({
      'WWW-Authenticate': 'Basic realm="Tenco Admin App"',
    }).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Required</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .container { max-width: 400px; margin: 0 auto; }
          .error { color: #dc3545; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔒 Authentication Required</h1>
          <p>Please enter your credentials to access Tenco Admin App</p>
          <div class="error">Access denied. Please check your credentials.</div>
        </div>
        <script>
          // Trigger browser's basic auth dialog
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        </script>
      </body>
      </html>
    `);
  }

  // Decode base64 credentials
  const credentials = Buffer.from(auth.slice(6), 'base64').toString();
  const [username, password] = credentials.split(':');

  const validUsername = process.env.ADMIN_USERNAME || 'admin';
  const validPassword = process.env.ADMIN_PASSWORD || 'admin123';

  if (username === validUsername && password === validPassword) {
    return next();
  }

  return res.status(401).set({
    'WWW-Authenticate': 'Basic realm="Tenco Admin App"',
  }).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Authentication Failed</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .container { max-width: 400px; margin: 0 auto; }
        .error { color: #dc3545; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>❌ Authentication Failed</h1>
        <p>Invalid credentials. Please try again.</p>
        <div class="error">Username or password incorrect.</div>
      </div>
      <script>
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      </script>
    </body>
    </html>
  `);
}

export default authMiddleware;
