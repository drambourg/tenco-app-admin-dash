/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-param-reassign */
import { Severity } from '@google-cloud/logging';
import Redis from 'ioredis';

import gcpLogger from '../gcp/gcp-logger';
import REDIS_CLIENTS from './redis-client.const';
import { RedisClientType } from './redis-client.type';
import { getRedisConfig } from './redis-config';

// Variable globale pour éviter les connexions multiples
let isConnecting = false;

const createRedisClient = async (type: RedisClientType): Promise<Redis> => {
  const clientInfo = REDIS_CLIENTS[type];

  // Return existing client if healthy
  if (
    clientInfo.client &&
    clientInfo.connected &&
    clientInfo.client.status === 'ready'
  ) {
    console.log(`✅ Reusing existing Redis ${type} client`);
    return clientInfo.client;
  }

  // Éviter les connexions multiples simultanées
  if (isConnecting && type === 'main') {
    throw new Error('Redis connection already in progress');
  }

  if (type === 'main') {
    isConnecting = true;
  }

  try {
    console.log(`🔄 Creating new Redis ${type} client...`);

    // Nettoyer l'ancien client s'il existe
    if (clientInfo.client) {
      try {
        await clientInfo.client.disconnect();
      } catch (e) {
        console.log(`🧹 Cleaned up old ${type} client`);
      }
      clientInfo.client = null;
      clientInfo.connected = false;
    }

    const clientOptions = getRedisConfig();

    // Créer le client avec une approche step-by-step
    const client = new Redis(clientOptions);

    // Variables pour tracking
    let isReady = false;
    let hasError = false;

    // Setup event handlers AVANT toute opération
    client.on('connect', () => {
      console.log(`🔌 Redis ${type} connected`);
    });

    client.on('ready', () => {
      console.log(`✅ Redis ${type} ready`);
      clientInfo.connected = true;
      isReady = true;
    });

    client.on('error', (err) => {
      console.error(`❌ Redis ${type} error: ${err.message}`);
      clientInfo.connected = false;
      hasError = true;

      gcpLogger({
        fileLink: __filename,
        message: `Redis ${type} error: ${err.message}`,
        payload: { error: err.message, stack: err.stack, type },
        severity: Severity.error,
      });
    });

    client.on('close', () => {
      console.log(`🔐 Redis ${type} connection closed`);
      clientInfo.connected = false;
    });

    client.on('end', () => {
      console.log(`🔚 Redis ${type} connection ended`);
      clientInfo.connected = false;
    });

    client.on('reconnecting', (delay) => {
      console.log(`🔄 Redis ${type} reconnecting in ${delay}ms`);
      clientInfo.connected = false;
    });

    // Attendre la connexion avec timeout
    console.log(`⏳ Waiting for Redis ${type} to be ready...`);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Redis ${type} ready timeout after 30s`));
      }, 30000);

      const cleanup = () => {
        clearTimeout(timeout);
      };

      // Si déjà prêt
      if (client.status === 'ready') {
        cleanup();
        resolve();
        return;
      }

      // Attendre ready
      client.once('ready', () => {
        cleanup();
        resolve();
      });

      // Ou erreur
      client.once('error', (err) => {
        cleanup();
        reject(err);
      });

      // Ou close
      client.once('close', () => {
        cleanup();
        reject(
          new Error(`Redis ${type} connection closed during initialization`)
        );
      });
    });

    // Test de fonctionnement
    console.log(`🏓 Testing Redis ${type} with ping...`);
    const pong = await client.ping();
    if (pong !== 'PONG') {
      throw new Error(`Redis ${type} ping failed: ${pong}`);
    }

    // Test d'écriture/lecture simple
    const testKey = `test_${type}_${Date.now()}`;
    await client.set(testKey, 'test_value', 'EX', 10);
    const testValue = await client.get(testKey);
    if (testValue !== 'test_value') {
      throw new Error(`Redis ${type} read/write test failed`);
    }
    await client.del(testKey);

    // Tout est OK
    clientInfo.client = client;
    clientInfo.connected = true;

    console.log(`✅ Redis ${type} client successfully initialized`);
    console.log(`📊 Redis ${type} status: ${client.status}`);

    gcpLogger({
      message: `Redis ${type} client initialized successfully`,
      payload: {
        db: clientOptions.db,
        host: clientOptions.host,
        port: clientOptions.port,
        status: client.status,
        type,
      },
      severity: Severity.info,
    });

    return client;
  } catch (error) {
    console.error(`❌ Failed to create Redis ${type} client:`, error.message);

    clientInfo.connected = false;
    clientInfo.client = null;

    gcpLogger({
      fileLink: __filename,
      message: `Failed to initialize Redis ${type} client: ${error.message}`,
      payload: {
        error: error.message,
        redisHost: process.env.REDIS_HOST,
        redisPort: process.env.REDIS_PORT,
        stack: error.stack,
        type,
      },
      severity: Severity.error,
    });

    throw error;
  } finally {
    if (type === 'main') {
      isConnecting = false;
    }
  }
};

// Fonctions exportées avec retry automatique
export const getRedisClient = async (): Promise<Redis> => {
  try {
    return await createRedisClient('main');
  } catch (error) {
    console.log(`🔄 Redis main client failed, retrying in 5s...`);
    await new Promise((resolve) => {
      setTimeout(resolve, 5000);
    });
    return createRedisClient('main');
  }
};

export const getRedisSubscriber = async (): Promise<Redis> =>
  createRedisClient('subscriber');
export const getRedisPublisher = async (): Promise<Redis> =>
  createRedisClient('publisher');

export const closeRedisConnection = async (): Promise<void> => {
  console.log('🔄 Closing all Redis connections...');

  const closePromises = Object.entries(REDIS_CLIENTS).map(
    async ([type, clientInfo]) => {
      if (clientInfo.client) {
        try {
          console.log(`🔐 Closing Redis ${type} connection...`);
          await clientInfo.client.quit();
          clientInfo.connected = false;
          clientInfo.client = null;
          console.log(`✅ Redis ${type} connection closed`);
        } catch (error) {
          console.error(`❌ Error closing Redis ${type}:`, error.message);
        }
      }
    }
  );

  await Promise.allSettled(closePromises);
  console.log('✅ All Redis connections closed');
};

// Status et debugging
export const getRedisConnectionStatus = () => {
  const status = Object.fromEntries(
    Object.entries(REDIS_CLIENTS).map(([type, clientInfo]) => [
      type,
      {
        connected: clientInfo.connected,
        description: clientInfo.description,
        status: clientInfo.client?.status || 'disconnected',
      },
    ])
  );

  console.log('📊 Redis connections status:', status);
  return status;
};

export default {
  closeRedisConnection,
  getRedisClient,
  getRedisConnectionStatus,
};
