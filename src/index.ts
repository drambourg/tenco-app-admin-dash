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
  });

  // Set server timeout for Cloud Run
  server.timeout = 0;
  server.keepAliveTimeout = 5000;
  server.headersTimeout = 10000;

  // ÉTAPE 1: Redis en premier et SEUL
  let redisInitialized = false;
  try {
    console.log('🎯 === REDIS INITIALIZATION ===');
    console.log(
      `🔧 Redis configuration: ${process.env.REDIS_HOST || 'localhost'}:${
        process.env.REDIS_PORT || '6379'
      }`
    );

    const redis = await getRedisClient();

    // Tests approfondis
    console.log('🏓 Testing Redis operations...');
    await redis.ping();

    const info = await redis.info('server');
    const version = info.match(/redis_version:([^\r\n]+)/)?.[1] || 'unknown';
    console.log(`📊 Redis version: ${version}`);

    const memory = await redis.info('memory');
    const usedMemory =
      memory.match(/used_memory_human:([^\r\n]+)/)?.[1] || 'unknown';
    console.log(`💾 Redis memory: ${usedMemory}`);

    redisInitialized = true;
    console.log('✅ === REDIS READY ===');
  } catch (error) {
    console.error(`❌ === REDIS FAILED ===`);
    console.error(`❌ Redis error: ${error.message}`);
    console.error(
      `❌ Config: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
    );
    console.error(`❌ Make sure Redis server is running and accessible`);

    // Log l'erreur mais continuer
    gcpLogger({
      fileLink: __filename,
      message:
        'Redis initialization failed - app will run without Redis features',
      payload: {
        error: error.message,
        redisHost: process.env.REDIS_HOST,
        redisPort: process.env.REDIS_PORT,
        stack: error.stack,
      },
      severity: Severity.warning,
    });
  }

  // ÉTAPE 2: Bull Board seulement si Redis OK
  if (redisInitialized) {
    try {
      console.log('🎯 === BULL BOARD INITIALIZATION ===');
      const bullBoardService = BullBoardService.getInstance();
      await bullBoardService.initialize();

      const health = await bullBoardService.getHealth();
      if (health.healthy) {
        console.log('✅ Bull Board service initialized successfully');
        console.log(`📊 Queue monitored: ${health.queueName}`);
        console.log('✅ === BULL BOARD READY ===');
      } else {
        console.log(`⚠️ Bull Board unhealthy: ${health.error}`);
      }
    } catch (error) {
      console.error(`❌ Bull Board initialization failed:`, error.message);
      gcpLogger({
        fileLink: __filename,
        message: 'Bull Board initialization failed',
        payload: { error: error.message },
        severity: Severity.warning,
      });
    }
  } else {
    console.log('⏭️ Skipping Bull Board (Redis not available)');
  }

  // ÉTAPE 3: EMQX en dernier
  try {
    console.log('🎯 === EMQX INITIALIZATION ===');
    const emqxConfig = getEmqxConfig();

    const emqxService = EmqxClientService.getInstance(emqxConfig);
    await emqxService.connect();

    const status = emqxService.getStatus();
    if (status.connected) {
      console.log('✅ EMQX connected successfully');
      console.log(`🔌 Broker: ${emqxConfig.broker}:${emqxConfig.port}`);
      console.log(`👤 Client ID: ${emqxConfig.clientId}`);

      const pingResult = await emqxService.ping();
      console.log(`🏓 EMQX Ping: ${pingResult ? '✅ OK' : '❌ Failed'}`);
      console.log('✅ === EMQX READY ===');
    } else {
      console.log(`⚠️ EMQX not connected: ${status.error}`);
    }
  } catch (error) {
    console.error(`❌ EMQX initialization failed:`, error.message);
    console.log('ℹ️ Application will continue without EMQX connectivity');
  }

  // Résumé final
  console.log('🎉 === INITIALIZATION COMPLETE ===');
  console.log(`✅ Server: Running on port ${port}`);
  console.log(
    `${redisInitialized ? '✅' : '❌'} Redis: ${
      redisInitialized ? 'Connected' : 'Failed'
    }`
  );
  console.log(`✅ EMQX: Available for operations`);
  console.log('🎉 === READY TO SERVE ===');

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
