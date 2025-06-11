import { RedisOptions } from 'ioredis';

const getRedisConfig = (): RedisOptions => {
  // Fall back to environment variables
  const config = {
    db: parseInt(process.env.REDIS_DB || '0', 10),
    host: process.env.REDIS_HOST || '127.0.0.1',
    password: process.env.REDIS_PASSWORD || undefined,
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    retryStrategy: {
      maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '10', 10),
      retryDelayOnFailover: parseInt(
        process.env.REDIS_RETRY_DELAY || '100',
        10
      ),
    },
    settings: {
      debug: process.env.REDIS_DEBUG === 'true',
    },
  };

  // ioredis configuration (only using properties that actually exist)
  const ioredisConfig: RedisOptions = {
    // Re-subscribe to channels after reconnect
    autoResendUnfulfilledCommands: true,

    // Reconnection options
    autoResubscribe: true,

    // How long to wait for initial connection
    commandTimeout: 5000,

    // Connection timeouts
    connectTimeout: 5000,

    db: config.db || 0,

    // Performance options
    enableAutoPipelining: false,

    // Wait for Redis to be ready before emitting 'ready'
    enableOfflineQueue: true,

    // Connect immediately
    enableReadyCheck: true,

    // Basic connection
    host: config.host,

    // Timeout for individual commands
    // Socket options
    keepAlive: 30000,

    // Connection behavior
    lazyConnect: false,

    // Queue commands when disconnected
    // Retry strategy for commands
    maxRetriesPerRequest: config.retryStrategy?.maxRetries || 10,

    // Keep connection alive (in ms)
    noDelay: true,

    password: config.password || undefined,

    port: config.port,

    // Resend pending commands after reconnect
    // Reconnect on specific errors
    reconnectOnError: (err: Error) => {
      const targetErrors = ['READONLY', 'MASTERDOWN', 'LOADING'];
      return targetErrors.some((errorType) => err.message.includes(errorType));
    },

    // Custom retry strategy function
    retryStrategy: (times: number) => {
      const maxRetries = config.retryStrategy?.maxRetries || 10;
      if (times > maxRetries) {
        return null; // Stop retrying
      }
      const retryDelay = config.retryStrategy?.retryDelayOnFailover || 100;
      return Math.min(times * retryDelay, 3000);
    }, // Disable auto-pipelining for predictable behavior

    // Debugging (only if debug is enabled)
    ...(config.settings?.debug && {
      showFriendlyErrorStack: true,
    }),
  };

  return ioredisConfig;
};

// eslint-disable-next-line import/prefer-default-export
export { getRedisConfig };
