import { Severity } from '@google-cloud/logging';
import Redis from 'ioredis';

import gcpLogger from '../gcp/gcp-logger';
import REDIS_CLIENTS from './redis-client.const';
import { RedisClientType } from './redis-client.type';
import { getRedisConfig } from './redis-config';

const createRedisClient = async (type: RedisClientType): Promise<Redis> => {
  const clientInfo = REDIS_CLIENTS[type];

  // Return existing client if already connected
  if (clientInfo.client && clientInfo.connected) {
    return clientInfo.client;
  }

  try {
    const clientOptions = getRedisConfig();
    const client = new Redis({
      ...clientOptions,
      lazyConnect: true,
    });

    // Common event handlers
    const setupEventHandlers = (redis: Redis, clientType: RedisClientType) => {
      redis.on('error', (err) => {
        clientInfo.connected = false;
        gcpLogger({
          fileLink: __filename,
          message: `Redis ${clientType.toUpperCase()} client error: ${
            err.message
          }`,
          payload: { error: err.stack || err.message, type: clientType },
          severity: Severity.error,
        });
      });

      redis.on('connect', () => {
        gcpLogger({
          message: `Redis ${clientType.toUpperCase()} client connected`,
          payload: { type: clientType },
          severity: Severity.info,
        });
      });

      redis.on('ready', () => {
        clientInfo.connected = true;
        gcpLogger({
          message: `Redis ${clientType.toUpperCase()} client ready`,
          payload: { description: clientInfo.description, type: clientType },
          severity: Severity.info,
        });
      });

      redis.on('reconnecting', () => {
        clientInfo.connected = false;
        gcpLogger({
          message: `Redis ${clientType.toUpperCase()} client reconnecting`,
          payload: { type: clientType },
          severity: Severity.warning,
        });
      });

      redis.on('close', () => {
        clientInfo.connected = false;
        gcpLogger({
          message: `Redis ${clientType.toUpperCase()} connection closed`,
          payload: { type: clientType },
          severity: Severity.warning,
        });
      });
    };

    // Setup event handlers
    setupEventHandlers(client, type);

    await client.connect();

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            `Redis ${type} client ready timeout exceeded. ` +
              `Current status: ${client.status}. ` +
              `Check if Redis server is running.`
          )
        );
      }, 10000);

      if (client.status === 'ready') {
        clearTimeout(timeout);
        resolve();
      } else {
        client.once('ready', () => {
          clearTimeout(timeout);
          resolve();
        });

        client.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      }
    });

    // Store the client
    clientInfo.client = client;
    clientInfo.connected = true;

    gcpLogger({
      isDebugLog: true,
      message: `✅ Redis ${type.toUpperCase()} client initialized successfully`,
      payload: {
        description: clientInfo.description,
        status: client.status,
        type,
      },
      severity: Severity.info,
    });

    return client;
  } catch (error) {
    clientInfo.connected = false;
    gcpLogger({
      fileLink: __filename,
      message: `Failed to initialize Redis ${type.toUpperCase()} client: ${
        error.message
      }`,
      payload: { error: error.stack || error.message, type },
      severity: Severity.error,
    });

    if (type === 'main') {
      setTimeout(() => {
        createRedisClient(type).catch((err) => {
          console.error(`Background Redis ${type} reconnection failed:`, err);
        });
      }, 5000);
    }

    throw error;
  }
};

/**
 *  Main Redis client for cache operations
 */
export const getRedisClient = async (): Promise<Redis> =>
  createRedisClient('main');

/**
 * Dedicated Redis subscriber for SSE pub/sub
 */
export const getRedisSubscriber = async (): Promise<Redis> =>
  createRedisClient('subscriber');

/**
 *  Dedicated Redis publisher for publishing messages
 */
export const getRedisPublisher = async (): Promise<Redis> =>
  createRedisClient('publisher');

export const closeRedisConnection = async (): Promise<void> => {
  const closePromises = Object.entries(REDIS_CLIENTS).map(
    async ([type, clientInfo]) => {
      if (clientInfo.client) {
        try {
          await clientInfo.client.quit();
          // eslint-disable-next-line no-param-reassign
          clientInfo.connected = false;
          // eslint-disable-next-line no-param-reassign
          clientInfo.client = null;
          gcpLogger({
            message: `Redis ${type.toUpperCase()} connection closed`,
            payload: { type },
            severity: Severity.info,
          });
        } catch (error) {
          gcpLogger({
            message: `Error closing Redis ${type.toUpperCase()} connection: ${
              error.message
            }`,
            payload: { error: error.message, type },
            severity: Severity.error,
          });
        }
      }
    }
  );

  await Promise.allSettled(closePromises);

  gcpLogger({
    message: '✅ All Redis connections closed',
    severity: Severity.info,
  });
};

export const getRedisConnectionStatus = () =>
  Object.fromEntries(
    Object.entries(REDIS_CLIENTS).map(([type, clientInfo]) => [
      type,
      {
        connected: clientInfo.connected,
        description: clientInfo.description,
        status: clientInfo.client?.status || 'disconnected',
      },
    ])
  );

export const getRedisClientByType = async (
  type: RedisClientType
): Promise<Redis> => createRedisClient(type);

export default {
  closeRedisConnection,
  getRedisClient,
};
