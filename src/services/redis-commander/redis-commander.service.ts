/* eslint-disable class-methods-use-this */
/* eslint-disable no-case-declarations */
import { Severity } from '@google-cloud/logging';
import Redis from 'ioredis';

import {
  RedisCommanderConfig,
  RedisDataType,
  RedisHashValue,
  RedisKeyInfo,
  RedisKeyPattern,
  RedisListValue,
  RedisServerInfo,
  RedisSetValue,
  RedisStats,
  RedisValue,
  RedisZSetValue,
} from '../../types/redis-commander.interface';
import gcpLogger from '../../utils/gcp/gcp-logger';
import { getRedisClient } from '../../utils/redis/redis-client';

// eslint-disable-next-line import/prefer-default-export
export class RedisCommanderService {
  // eslint-disable-next-line no-use-before-define
  private static instance: RedisCommanderService;
  private redisClient: Redis | null = null;

  public static getInstance(): RedisCommanderService {
    if (!RedisCommanderService.instance) {
      RedisCommanderService.instance = new RedisCommanderService();
    }
    return RedisCommanderService.instance;
  }

  private async getClient(): Promise<Redis> {
    if (!this.redisClient) {
      this.redisClient = await getRedisClient();
    }
    return this.redisClient;
  }

  /**
   * Get all keys matching a pattern
   */
  public async getKeys(
    config: RedisCommanderConfig = {}
  ): Promise<RedisKeyInfo[]> {
    try {
      const client = await this.getClient();
      const { database = 0, limit = 100, pattern = '*' } = config;

      // Switch to specified database
      await client.select(database);

      // Get keys using SCAN for better performance
      const keys: string[] = [];
      const scanStream = client.scanStream({
        count: limit,
        match: pattern,
      });

      for await (const resultKeys of scanStream) {
        keys.push(...resultKeys);
        if (keys.length >= limit) {
          break;
        }
      }

      // Get additional info for each key
      const keyInfos: RedisKeyInfo[] = [];
      for (const key of keys.slice(0, limit)) {
        const [type, ttl, memoryUsage] = await Promise.all([
          client.type(key),
          client.ttl(key),
          this.getKeySize(client, key),
        ]);

        keyInfos.push({
          key,
          size: memoryUsage,
          ttl,
          type,
        });
      }

      return keyInfos;
    } catch (error) {
      gcpLogger({
        fileLink: `redis-commander.service.ts:getKeys`,
        message: 'Error getting Redis keys',
        payload: { config, error: error.message },
        severity: Severity.error,
      });
      throw new Error(`Failed to get keys: ${error.message}`);
    }
  }

  /**
   * Get value of a specific key
   */
  public async getValue(key: string, database = 0): Promise<RedisValue> {
    try {
      const client = await this.getClient();
      await client.select(database);

      const type = (await client.type(key)) as RedisDataType;
      const ttl = await client.ttl(key);
      const size = await this.getKeySize(client, key);

      let value: any;

      switch (type) {
        case 'string':
          value = await client.get(key);
          // Try to parse as JSON if possible
          try {
            value = JSON.parse(value);
          } catch {
            // Keep as string if not JSON
          }
          break;

        case 'hash':
          const hashValue = await client.hgetall(key);
          value = hashValue as RedisHashValue;
          break;

        case 'list':
          const listValue = await client.lrange(key, 0, -1);
          value = listValue as RedisListValue;
          break;

        case 'set':
          const setValue = await client.smembers(key);
          value = setValue as RedisSetValue;
          break;

        case 'zset':
          const zsetValue = await client.zrange(key, 0, -1, 'WITHSCORES');
          const zsetFormatted: RedisZSetValue = [];
          for (let i = 0; i < zsetValue.length; i += 2) {
            zsetFormatted.push({
              member: zsetValue[i],
              score: parseFloat(zsetValue[i + 1]),
            });
          }
          value = zsetFormatted;
          break;

        default:
          value = null;
      }

      return {
        key,
        size,
        ttl,
        type,
        value,
      };
    } catch (error) {
      gcpLogger({
        fileLink: `redis-commander.service.ts:getValue`,
        message: 'Error getting Redis value',
        payload: { database, error: error.message, key },
        severity: Severity.error,
      });
      throw new Error(`Failed to get value: ${error.message}`);
    }
  }

  /**
   * Get server information
   */
  public async getServerInfo(): Promise<RedisServerInfo> {
    try {
      const client = await this.getClient();
      const info = await client.info();

      // Parse INFO response
      const sections = this.parseRedisInfo(info);

      return {
        connectedClients: parseInt(
          sections.clients?.connected_clients || '0',
          10
        ),
        databases: await this.getDatabasesInfo(),
        maxMemory: sections.memory?.maxmemory || '0',
        maxMemoryHuman: sections.memory?.maxmemory_human || '0B',
        mode: sections.server?.redis_mode || 'standalone',
        usedMemory: sections.memory?.used_memory || '0',
        usedMemoryHuman: sections.memory?.used_memory_human || '0B',
        version: sections.server?.redis_version || 'unknown',
      };
    } catch (error) {
      gcpLogger({
        fileLink: `redis-commander.service.ts:getServerInfo`,
        message: 'Error getting Redis server info',
        payload: { error: error.message },
        severity: Severity.error,
      });
      throw new Error(`Failed to get server info: ${error.message}`);
    }
  }

  /**
   * Get database statistics
   */
  public async getDatabasesInfo(): Promise<
    Array<{ db: number; keyCount: number; expires: number; avgTtl: number }>
  > {
    try {
      const client = await this.getClient();
      const info = await client.info('keyspace');
      const databases = [];

      const lines = info.split('\r\n');
      for (const line of lines) {
        if (line.startsWith('db')) {
          const match = line.match(
            /db(\d+):keys=(\d+),expires=(\d+),avg_ttl=(\d+)/
          );
          if (match) {
            databases.push({
              avgTtl: parseInt(match[4], 10),
              db: parseInt(match[1], 10),
              expires: parseInt(match[3], 10),
              keyCount: parseInt(match[2], 10),
            });
          }
        }
      }

      return databases;
    } catch (error) {
      gcpLogger({
        fileLink: `redis-commander.service.ts:getDatabasesInfo`,
        message: 'Error getting databases info',
        payload: { error: error.message },
        severity: Severity.error,
      });
      return [];
    }
  }

  /**
   * Get common key patterns in the database
   */
  public async getKeyPatterns(database = 0): Promise<RedisKeyPattern[]> {
    try {
      const client = await this.getClient();
      await client.select(database);

      const keys = await this.getKeys({ database, limit: 1000 });
      const patterns = new Map<string, number>();

      // Analyze key patterns
      for (const keyInfo of keys) {
        const pattern = this.extractPattern(keyInfo.key);
        patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
      }

      // Convert to array and sort by count
      return Array.from(patterns.entries())
        .map(([pattern, count]) => ({
          count,
          description: this.getPatternDescription(pattern),
          pattern,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20); // Top 20 patterns
    } catch (error) {
      gcpLogger({
        fileLink: `redis-commander.service.ts:getKeyPatterns`,
        message: 'Error getting key patterns',
        payload: { database, error: error.message },
        severity: Severity.error,
      });
      return [];
    }
  }

  /**
   * Delete a key
   */
  public async deleteKey(key: string, database = 0): Promise<boolean> {
    try {
      const client = await this.getClient();
      await client.select(database);
      const result = await client.del(key);
      return result > 0;
    } catch (error) {
      gcpLogger({
        fileLink: `redis-commander.service.ts:deleteKey`,
        message: 'Error deleting Redis key',
        payload: { database, error: error.message, key },
        severity: Severity.error,
      });
      throw new Error(`Failed to delete key: ${error.message}`);
    }
  }

  /**
   * Get Redis statistics
   */
  public async getStats(): Promise<RedisStats> {
    try {
      const client = await this.getClient();
      const info = await client.info();
      const sections = this.parseRedisInfo(info);

      const keyspaceHits = parseInt(sections.stats?.keyspace_hits || '0', 10);
      const keyspaceMisses = parseInt(
        sections.stats?.keyspace_misses || '0',
        10
      );
      const hitRate =
        keyspaceHits + keyspaceMisses > 0
          ? (keyspaceHits / (keyspaceHits + keyspaceMisses)) * 100
          : 0;

      const databases = await this.getDatabasesInfo();
      const totalKeys = databases.reduce((sum, db) => sum + db.keyCount, 0);

      return {
        blockedClients: parseInt(sections.clients?.blocked_clients || '0', 10),
        connectedClients: parseInt(
          sections.clients?.connected_clients || '0',
          10
        ),
        hitRate,
        keyspaceHits,
        keyspaceMisses,
        totalKeys,
        totalMemory: {
          fragmentation: parseFloat(
            sections.memory?.mem_fragmentation_ratio || '1'
          ),
          peak: parseInt(sections.memory?.used_memory_peak || '0', 10),
          rss: parseInt(sections.memory?.used_memory_rss || '0', 10),
          used: parseInt(sections.memory?.used_memory || '0', 10),
        },
        uptime: parseInt(sections.server?.uptime_in_seconds || '0', 10),
        version: sections.server?.redis_version || 'unknown',
      };
    } catch (error) {
      gcpLogger({
        fileLink: `redis-commander.service.ts:getStats`,
        message: 'Error getting Redis stats',
        payload: { error: error.message },
        severity: Severity.error,
      });
      throw new Error(`Failed to get stats: ${error.message}`);
    }
  }

  // Helper methods

  private async getKeySize(client: Redis, key: string): Promise<number> {
    try {
      // Use MEMORY USAGE command if available (Redis 4.0+)
      const usage = await client.memory('USAGE', key);
      return usage || 0;
    } catch {
      // Fallback to estimating size based on type
      const type = await client.type(key);
      switch (type) {
        case 'string':
          return (await client.strlen(key)) || 0;
        case 'list':
          return (await client.llen(key)) || 0;
        case 'set':
          return (await client.scard(key)) || 0;
        case 'zset':
          return (await client.zcard(key)) || 0;
        case 'hash':
          return (await client.hlen(key)) || 0;
        default:
          return 0;
      }
    }
  }

  private parseRedisInfo(info: string): Record<string, Record<string, string>> {
    const sections: Record<string, Record<string, string>> = {};
    let currentSection = '';

    const lines = info.split('\r\n');
    for (const line of lines) {
      if (line.startsWith('#')) {
        currentSection = line.substring(2).toLowerCase();
        sections[currentSection] = {};
      } else if (line.includes(':') && currentSection) {
        const [key, value] = line.split(':');
        sections[currentSection][key] = value;
      }
    }

    return sections;
  }

  private extractPattern(key: string): string {
    // Replace numbers with placeholders to identify patterns
    return key
      .replace(/\d+/g, '*')
      .replace(/:[^:]*$/, ':*') // Replace last segment after colon
      .replace(/\*+/g, '*'); // Normalize multiple asterisks
  }

  private getPatternDescription(pattern: string): string {
    // Map common patterns to descriptions
    const descriptions: Record<string, string> = {
      'cache:*': 'Cache entries',
      'datapoint:*': 'Sensor datapoints',
      'device-history:*': 'Device history records',
      'device:*': 'Device information',
      'processed-datapoint:*': 'Processed sensor data',
      'session:*': 'User sessions',
      'worksite:*': 'Worksite data',
    };

    return descriptions[pattern] || 'Custom keys';
  }

  /**
   * Delete all keys matching a pattern
   */
  public async deleteKeysByPattern(
    pattern: string,
    database = 0
  ): Promise<number> {
    try {
      const client = await this.getClient();
      await client.select(database);

      let deletedCount = 0;
      const scanStream = client.scanStream({
        count: 100,
        match: pattern,
      });

      const pipeline = client.pipeline();
      let batchCount = 0;

      for await (const keys of scanStream) {
        for (const key of keys) {
          pipeline.del(key);
          batchCount += 1;

          // Execute pipeline in batches of 100
          if (batchCount >= 100) {
            const results = await pipeline.exec();
            deletedCount +=
              results?.filter(([err, result]) => !err && result === 1).length ||
              0;
            batchCount = 0;
          }
        }
      }

      // Execute remaining commands
      if (batchCount > 0) {
        const results = await pipeline.exec();
        deletedCount +=
          results?.filter(([err, result]) => !err && result === 1).length || 0;
      }

      return deletedCount;
    } catch (error) {
      gcpLogger({
        fileLink: `redis-commander.service.ts:deleteKeysByPattern`,
        message: 'Error deleting keys by pattern',
        payload: { database, error: error.message, pattern },
        severity: Severity.error,
      });
      throw new Error(`Failed to delete keys by pattern: ${error.message}`);
    }
  }

  /**
   * Clear entire database
   */
  public async clearDatabase(database = 0): Promise<boolean> {
    try {
      const client = await this.getClient();
      await client.select(database);
      await client.flushdb();
      return true;
    } catch (error) {
      gcpLogger({
        fileLink: `redis-commander.service.ts:clearDatabase`,
        message: 'Error clearing database',
        payload: { database, error: error.message },
        severity: Severity.error,
      });
      throw new Error(`Failed to clear database: ${error.message}`);
    }
  }

  /**
   * Clear all databases
   */
  public async clearAllDatabases(): Promise<boolean> {
    try {
      const client = await this.getClient();
      await client.flushall();
      return true;
    } catch (error) {
      gcpLogger({
        fileLink: `redis-commander.service.ts:clearAllDatabases`,
        message: 'Error clearing all databases',
        payload: { error: error.message },
        severity: Severity.error,
      });
      throw new Error(`Failed to clear all databases: ${error.message}`);
    }
  }
}
