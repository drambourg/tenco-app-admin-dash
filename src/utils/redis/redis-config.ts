/* eslint-disable import/prefer-default-export */
import { RedisOptions } from 'ioredis';

const getRedisConfig = (): RedisOptions => {
  const host = process.env.REDIS_HOST || '127.0.0.1';
  const port = parseInt(process.env.REDIS_PORT || '6379', 10);
  const password = process.env.REDIS_PASSWORD || undefined;
  const db = parseInt(process.env.REDIS_DB || '0', 10);

  console.log(`🔧 Redis config: ${host}:${port} (db: ${db})`);

  // Configuration ultra-simple pour éviter les conflits
  const config: RedisOptions = {
    // 60 secondes
    commandTimeout: 30000,

    // Timeouts simples
    connectTimeout: 60000,

    db,

    enableOfflineQueue: true,

    // Options de base uniquement
    enableReadyCheck: true,

    host,

    // Options de keep-alive
    keepAlive: 30000,

    // 30 secondes
    // Connexion directe sans lazy loading
    lazyConnect: false,

    // Éviter les options problématiques
    maxRetriesPerRequest: 3,

    password,

    port,

    // Retry strategy simple
    retryStrategy: (times: number) => {
      console.log(`🔄 Redis retry attempt ${times}`);
      if (times > 3) {
        console.log(`❌ Redis max retries exceeded`);
        return null;
      }
      return Math.min(times * 2000, 10000); // 2s, 4s, 6s
    },

    // Pas d'options avancées qui peuvent causer des conflits
  };

  return config;
};

export { getRedisConfig };
