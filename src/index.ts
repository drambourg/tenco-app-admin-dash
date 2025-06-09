import * as functions from '@google-cloud/functions-framework';
import { Severity } from '@google-cloud/logging';

import { API_RESPONSES, LOG_MESSAGES } from './config/config.const';
import validateEnv from './config/validateEnv';
import { FUNCTION_NAMES } from './routes/routes.const';
import { HTTP_CODES } from './utils/error';
import gcpLogger from './utils/gcp/gcp-logger';
import { createApp, createServer, getServerPort } from './utils/server';

// Environment validation
try {
  validateEnv();
} catch (error) {
  gcpLogger({
    fileLink: __filename,
    message: `${LOG_MESSAGES.ENV_VALIDATION_FAILED}: ${
      error.message || JSON.stringify(error)
    }`,
    payload: {
      error: error.stack || error.message || JSON.stringify(error),
      missingEnvVars: error.errors || 'Unknown errors',
    },
    severity: Severity.critical,
    withCloudRunInfos: true,
  });
  process.exit(1);
}

// Application creation
const app = createApp();

// 🔧 SOLUTION : Vérifier si on est en mode Cloud Functions
const isCloudFunction = process.env.FUNCTION_TARGET || process.env.K_SERVICE;

// Cloud Function registration
functions.http(FUNCTION_NAMES.IOT_SIMULATOR, (req, res) => {
  if (req.method !== 'POST') {
    return res.status(HTTP_CODES.METHOD_NOT_ALLOWED).send({
      error: API_RESPONSES.METHOD_NOT_ALLOWED.message,
    });
  }
  // Pass the request to the Express router
  // eslint-disable-next-line no-underscore-dangle
  app._router.handle(req, res);
});

// ✅ SERVEUR LOCAL UNIQUEMENT pour développement
if (
  !isCloudFunction &&
  (process.env.NODE_ENV === 'development' || require.main === module)
) {
  const server = createServer(app);

  // Shutdown handler function
  const handleShutdown = async (): Promise<void> => {
    try {
      server.close();
      process.exit(0);
    } catch (error) {
      gcpLogger({
        fileLink: __filename,
        message: ` ${error.message}`,
        payload: {
          error: error.stack || error.message,
        },
        severity: Severity.error,
      });
      process.exit(1);
    }
  };

  // Handling shutdown signals
  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown);

  // Server startup for local development
  const startServer = async (port: number): Promise<void> => {
    server.listen(port, async () => {
      console.log(
        process.env.NODE_ENV === 'development'
          ? LOG_MESSAGES.DEV_SERVER_STARTED(port)
          : LOG_MESSAGES.SERVER_STARTED(port)
      );
    });
  };

  // Start the server only in local mode
  const serverPort = getServerPort();
  startServer(serverPort);
}

// Export for testing purposes
// eslint-disable-next-line import/prefer-default-export
export { app };
