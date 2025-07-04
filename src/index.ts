import { Severity } from '@google-cloud/logging';

import { LOG_MESSAGES } from './config/config.const';
import validateEnv from './config/validateEnv';
import BullBoardService from './services/bull-board/bull-board.service';
import EmqxClientService from './services/emqx/client/emqx-client.service';
import { getEmqxConfig } from './services/emqx/client/emqx-config';
import gcpLogger from './utils/gcp/gcp-logger';
import {
  closeRedisConnection,
  getRedisClient,
} from './utils/redis/redis-client';
import { createApp, getServerPort } from './utils/server';

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

/// Graceful shutdown handler
const handleShutdown = async (): Promise<void> => {
  console.log('🔄 Shutting down gracefully...');
  try {
    // Close EMQX connection
    try {
      const emqxService = EmqxClientService.getInstance();
      if (emqxService.getStatus().connected) {
        await emqxService.disconnect();
        console.log('✅ EMQX connection closed');
      }
    } catch (error) {
      console.log('ℹ️  EMQX service was not initialized');
    }

    // Close Bull Board service
    const bullBoardService = BullBoardService.getInstance();
    await bullBoardService.cleanup();
    console.log('✅ Bull Board service closed');

    await closeRedisConnection();
    console.log('✅ Redis connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    gcpLogger({
      fileLink: __filename,
      message: `Shutdown error: ${error.message}`,
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

// Start server function
const startServer = async (): Promise<void> => {
  const port = getServerPort();

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Tenco Admin App started successfully`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 Server running on port ${port}`);
    console.log(`📱 Dashboard: http://localhost:${port}/`);
    console.log(`🗃️ Redis Commander: http://localhost:${port}/redis-commander`);
    console.log(`📊 Bull Board: http://localhost:${port}/bull-board`);
    console.log(`📡 IoT Simulator: http://localhost:${port}/iot-simulator`);
    console.log(`🔌 EMQX Service: Available for MQTT operations`);

    gcpLogger({
      fileLink: __filename,
      message: 'Application started successfully',
      payload: {
        environment: process.env.NODE_ENV,
        pid: process.pid,
        port,
      },
      severity: Severity.info,
    });
  });

  // Set server timeout for Cloud Run
  server.timeout = 0; // Disable timeout
  server.keepAliveTimeout = 5000;
  server.headersTimeout = 10000;

  // Initialize Redis connection
  try {
    console.log('🔄 Initializing Redis connection...');
    const redis = await getRedisClient();

    redis.on('error', (err) => {
      console.error(`❌ Redis error:`, err);
      gcpLogger({
        fileLink: __filename,
        message: 'Redis connection error',
        payload: { error: err.message },
        severity: Severity.error,
      });
    });

    redis.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    redis.on('ready', () => {
      console.log('✅ Redis ready for operations');
    });

    console.log('✅ Redis client initialized');
  } catch (error) {
    console.error(`❌ Redis initialization failed:`, error);
    gcpLogger({
      fileLink: __filename,
      message: 'Redis initialization failed',
      payload: { error: error.message },
      severity: Severity.warning, // Warning instead of error to not crash the app
    });
    // Don't exit - let the app run without Redis if needed
  }

  // Initialize EMQX connection
  try {
    console.log('🔄 Initializing EMQX connection...');
    const emqxConfig = getEmqxConfig();

    gcpLogger({
      fileLink: __filename,
      message: 'EMQX configuration loaded',
      payload: {
        broker: emqxConfig.broker,
        clientId: emqxConfig.clientId,
        hasCredentials: !!emqxConfig.username,
        port: emqxConfig.port,
      },
      severity: Severity.info,
    });

    const emqxService = EmqxClientService.getInstance(emqxConfig);
    await emqxService.connect();

    const status = emqxService.getStatus();
    if (status.connected) {
      console.log('✅ EMQX connected successfully');
      console.log(`🔌 Broker: ${emqxConfig.broker}:${emqxConfig.port}`);
      console.log(`👤 Client ID: ${emqxConfig.clientId}`);

      // Test de ping EMQX
      const pingResult = await emqxService.ping();
      console.log(`🏓 EMQX Ping: ${pingResult ? '✅ OK' : '❌ Failed'}`);

      gcpLogger({
        fileLink: __filename,
        message: 'EMQX service initialized successfully',
        payload: {
          broker: emqxConfig.broker,
          clientId: emqxConfig.clientId,
          lastConnected: status.lastConnected,
          pingResult,
        },
        severity: Severity.info,
      });
    } else {
      console.log(
        `⚠️ EMQX service initialized but not connected: ${status.error}`
      );

      gcpLogger({
        fileLink: __filename,
        message: 'EMQX service initialized but connection failed',
        payload: {
          error: status.error,
          reconnectAttempts: status.reconnectAttempts,
        },
        severity: Severity.warning,
      });
    }
  } catch (error) {
    console.error(`❌ EMQX initialization failed:`, error);
    gcpLogger({
      fileLink: __filename,
      message: 'EMQX initialization failed',
      payload: {
        config: {
          broker: process.env.EMQX_BROKER || 'not-set',
          port: process.env.EMQX_PORT || 'not-set',
        },
        error: error.message,
        stack: error.stack,
      },
      severity: Severity.warning, // Warning instead of error to not crash the app
    });
    console.log('ℹ️  Application will continue without EMQX connectivity');
    // Don't exit - let the app run without EMQX if needed
  }

  // Initialize Bull Board service
  try {
    console.log('🔄 Initializing Bull Board service...');
    const bullBoardService = BullBoardService.getInstance();
    await bullBoardService.initialize();

    // Test Bull Board health
    const health = await bullBoardService.getHealth();
    if (health.healthy) {
      console.log('✅ Bull Board service initialized successfully');
      console.log(`📊 Queue monitored: ${health.queueName}`);
    } else {
      console.log(
        `⚠️ Bull Board service initialized but unhealthy: ${health.error}`
      );
    }
  } catch (error) {
    console.error(`❌ Bull Board initialization failed:`, error);
    gcpLogger({
      fileLink: __filename,
      message: 'Bull Board initialization failed',
      payload: { error: error.message },
      severity: Severity.warning, // Warning instead of error to not crash the app
    });
    // Don't exit - let the app run without Bull Board if needed
  }

  // Handle server errors
  server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port ${port} is already in use`);
    } else {
      console.error(`❌ Server error:`, error);
    }
    process.exit(1);
  });
};

// Start the server
startServer().catch((error) => {
  console.error('❌ Failed to start server:', error);
  gcpLogger({
    fileLink: __filename,
    message: 'Failed to start server',
    payload: { error: error.message },
    severity: Severity.critical,
  });
  process.exit(1);
});

// Export for testing purposes
// eslint-disable-next-line import/prefer-default-export
export { app };
