/* eslint-disable class-methods-use-this */
// src/controllers/redis-commander.controller.ts

import { Severity } from '@google-cloud/logging';
import { Request, Response } from 'express';

import { RedisCommanderService } from '../services/redis-commander/redis-commander.service';
import {
  RedisCommanderConfig,
  RedisCommanderResponse,
} from '../types/redis-commander.interface';
import gcpLogger from '../utils/gcp/gcp-logger';
import { getRedisCommanderHTML } from './redis-commander/redis-commander.utils';

export class RedisCommanderController {
  private redisCommanderService: RedisCommanderService;

  constructor() {
    this.redisCommanderService = RedisCommanderService.getInstance();
  }

  /**
   * Get all keys from Redis
   */
  public getKeys = async (req: Request, res: Response): Promise<void> => {
    const functionName = 'getKeys';

    try {
      const {
        database = 0,
        limit = 100,
        offset = 0,
        pattern = '*',
      } = req.query;

      const config: RedisCommanderConfig = {
        database: parseInt(database as string, 10),
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
        pattern: pattern as string,
      };

      const keys = await this.redisCommanderService.getKeys(config);

      const response: RedisCommanderResponse = {
        data: keys,
        message: `Found ${keys.length} keys`,
        success: true,
        timestamp: new Date().toISOString(),
      };

      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: `Successfully retrieved ${keys.length} keys`,
        payload: { database: config.database, pattern: config.pattern },
        severity: Severity.info,
      });

      res.status(200).json(response);
    } catch (error) {
      const response: RedisCommanderResponse = {
        error: error.message,
        message: 'Failed to retrieve keys',
        success: false,
        timestamp: new Date().toISOString(),
      };

      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: 'Error retrieving Redis keys',
        payload: { error: error.message, query: req.query },
        severity: Severity.error,
      });

      res.status(500).json(response);
    }
  };

  /**
   * Get value of a specific key
   */
  public getValue = async (req: Request, res: Response): Promise<void> => {
    const functionName = 'getValue';

    try {
      const { key } = req.params;
      const { database = 0 } = req.query;

      if (!key) {
        const response: RedisCommanderResponse = {
          error: 'Key parameter is required',
          message: 'Missing key parameter',
          success: false,
          timestamp: new Date().toISOString(),
        };

        res.status(400).json(response);
        return;
      }

      const value = await this.redisCommanderService.getValue(
        key,
        parseInt(database as string, 10)
      );

      const response: RedisCommanderResponse = {
        data: value,
        message: `Retrieved value for key: ${key}`,
        success: true,
        timestamp: new Date().toISOString(),
      };

      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: `Successfully retrieved value for key: ${key}`,
        payload: { database, key, type: value.type },
        severity: Severity.info,
      });

      res.status(200).json(response);
    } catch (error) {
      const response: RedisCommanderResponse = {
        error: error.message,
        message: 'Failed to retrieve value',
        success: false,
        timestamp: new Date().toISOString(),
      };

      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: 'Error retrieving Redis value',
        payload: { error: error.message, key: req.params.key },
        severity: Severity.error,
      });

      res.status(500).json(response);
    }
  };

  /**
   * Get Redis server information
   */
  public getServerInfo = async (req: Request, res: Response): Promise<void> => {
    const functionName = 'getServerInfo';

    try {
      const serverInfo = await this.redisCommanderService.getServerInfo();

      const response: RedisCommanderResponse = {
        data: serverInfo,
        message: 'Retrieved server information',
        success: true,
        timestamp: new Date().toISOString(),
      };

      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: 'Successfully retrieved Redis server info',
        payload: { mode: serverInfo.mode, version: serverInfo.version },
        severity: Severity.info,
      });

      res.status(200).json(response);
    } catch (error) {
      const response: RedisCommanderResponse = {
        error: error.message,
        message: 'Failed to retrieve server information',
        success: false,
        timestamp: new Date().toISOString(),
      };

      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: 'Error retrieving Redis server info',
        payload: { error: error.message },
        severity: Severity.error,
      });

      res.status(500).json(response);
    }
  };

  /**
   * Get database information
   */
  public getDatabases = async (req: Request, res: Response): Promise<void> => {
    const functionName = 'getDatabases';

    try {
      const databases = await this.redisCommanderService.getDatabasesInfo();

      const response: RedisCommanderResponse = {
        data: databases,
        message: `Found ${databases.length} databases`,
        success: true,
        timestamp: new Date().toISOString(),
      };

      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: `Successfully retrieved ${databases.length} databases info`,
        payload: { databaseCount: databases.length },
        severity: Severity.info,
      });

      res.status(200).json(response);
    } catch (error) {
      const response: RedisCommanderResponse = {
        error: error.message,
        message: 'Failed to retrieve database information',
        success: false,
        timestamp: new Date().toISOString(),
      };

      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: 'Error retrieving databases info',
        payload: { error: error.message },
        severity: Severity.error,
      });

      res.status(500).json(response);
    }
  };

  /**
   * Set value of a specific key (nouvelle fonction)
   */
  public setValue = async (req: Request, res: Response): Promise<void> => {
    const functionName = 'setValue';

    try {
      const { key } = req.params;
      const { value } = req.body;
      const { database = 0 } = req.query;

      if (!key) {
        const response: RedisCommanderResponse = {
          error: 'Key parameter is required',
          message: 'Missing key parameter',
          success: false,
          timestamp: new Date().toISOString(),
        };

        res.status(400).json(response);
        return;
      }

      if (value === undefined || value === null) {
        const response: RedisCommanderResponse = {
          error: 'Value is required',
          message: 'Missing value in request body',
          success: false,
          timestamp: new Date().toISOString(),
        };

        res.status(400).json(response);
        return;
      }

      const success = await this.redisCommanderService.setValue(
        key,
        value,
        parseInt(database as string, 10)
      );

      const response: RedisCommanderResponse = {
        data: { updated: success },
        message: `Key ${key} updated successfully`,
        success,
        timestamp: new Date().toISOString(),
      };

      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: `Key value updated successfully: ${key}`,
        payload: { database, key, success },
        severity: Severity.info,
      });

      res.status(200).json(response);
    } catch (error) {
      const response: RedisCommanderResponse = {
        error: error.message,
        message: 'Failed to update value',
        success: false,
        timestamp: new Date().toISOString(),
      };

      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: 'Error updating Redis value',
        payload: { error: error.message, key: req.params.key },
        severity: Severity.error,
      });

      res.status(500).json(response);
    }
  };

  /**
   * Get key patterns analysis
   */
  public getKeyPatterns = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const functionName = 'getKeyPatterns';

    try {
      const { database = 0 } = req.query;
      const patterns = await this.redisCommanderService.getKeyPatterns(
        parseInt(database as string, 10)
      );

      const response: RedisCommanderResponse = {
        data: patterns,
        message: `Found ${patterns.length} key patterns`,
        success: true,
        timestamp: new Date().toISOString(),
      };

      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: `Successfully retrieved ${patterns.length} key patterns`,
        payload: { database, patternCount: patterns.length },
        severity: Severity.info,
      });

      res.status(200).json(response);
    } catch (error) {
      const response: RedisCommanderResponse = {
        error: error.message,
        message: 'Failed to retrieve key patterns',
        success: false,
        timestamp: new Date().toISOString(),
      };

      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: 'Error retrieving key patterns',
        payload: { error: error.message },
        severity: Severity.error,
      });

      res.status(500).json(response);
    }
  };

  /**
   * Delete a key
   */
  public deleteKey = async (req: Request, res: Response): Promise<void> => {
    const functionName = 'deleteKey';

    try {
      const { key } = req.params;
      const { database = 0 } = req.query;

      if (!key) {
        const response: RedisCommanderResponse = {
          error: 'Key parameter is required',
          message: 'Missing key parameter',
          success: false,
          timestamp: new Date().toISOString(),
        };

        res.status(400).json(response);
        return;
      }

      const deleted = await this.redisCommanderService.deleteKey(
        key,
        parseInt(database as string, 10)
      );

      const response: RedisCommanderResponse = {
        data: { deleted },
        message: deleted
          ? `Key ${key} deleted successfully`
          : `Key ${key} not found`,
        success: deleted,
        timestamp: new Date().toISOString(),
      };

      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: `Key deletion ${deleted ? 'successful' : 'failed'}: ${key}`,
        payload: { database, deleted, key },
        severity: deleted ? Severity.info : Severity.warning,
      });

      res.status(deleted ? 200 : 404).json(response);
    } catch (error) {
      const response: RedisCommanderResponse = {
        error: error.message,
        message: 'Failed to delete key',
        success: false,
        timestamp: new Date().toISOString(),
      };

      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: 'Error deleting Redis key',
        payload: { error: error.message, key: req.params.key },
        severity: Severity.error,
      });

      res.status(500).json(response);
    }
  };

  /**
   * Get Redis statistics
   */
  public getStats = async (req: Request, res: Response): Promise<void> => {
    const functionName = 'getStats';

    try {
      const stats = await this.redisCommanderService.getStats();

      const response: RedisCommanderResponse = {
        data: stats,
        message: 'Retrieved Redis statistics',
        success: true,
        timestamp: new Date().toISOString(),
      };

      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: 'Successfully retrieved Redis statistics',
        payload: {
          hitRate: `${stats.hitRate.toFixed(2)}%`,
          totalKeys: stats.totalKeys,
          version: stats.version,
        },
        severity: Severity.info,
      });

      res.status(200).json(response);
    } catch (error) {
      const response: RedisCommanderResponse = {
        error: error.message,
        message: 'Failed to retrieve statistics',
        success: false,
        timestamp: new Date().toISOString(),
      };

      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: 'Error retrieving Redis statistics',
        payload: { error: error.message },
        severity: Severity.error,
      });

      res.status(500).json(response);
    }
  };

  /**
   * Serve Redis Commander web interface
   */
  public serveInterface = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const functionName = 'serveInterface';

    try {
      // Serve the HTML interface directly
      res.setHeader('Content-Type', 'text/html');
      res.send(getRedisCommanderHTML());

      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: 'Redis Commander interface served',
        payload: { userAgent: req.get('User-Agent') },
        severity: Severity.info,
      });
    } catch (error) {
      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: 'Error serving Redis Commander interface',
        payload: { error: error.message },
        severity: Severity.error,
      });

      res.status(500).send('Error loading Redis Commander interface');
    }
  };

  /**
   * Delete keys by pattern
   */
  public deleteKeysByPattern = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const functionName = 'deleteKeysByPattern';

    try {
      const { pattern } = req.body;
      const { database = 0 } = req.query;

      if (!pattern) {
        const response: RedisCommanderResponse = {
          error: 'Pattern is required',
          message: 'Missing pattern in request body',
          success: false,
          timestamp: new Date().toISOString(),
        };

        res.status(400).json(response);
        return;
      }

      const deletedCount = await this.redisCommanderService.deleteKeysByPattern(
        pattern,
        parseInt(database as string, 10)
      );

      const response: RedisCommanderResponse = {
        data: { deletedCount },
        message: `Deleted ${deletedCount} keys matching pattern: ${pattern}`,
        success: true,
        timestamp: new Date().toISOString(),
      };

      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: `Successfully deleted ${deletedCount} keys with pattern: ${pattern}`,
        payload: { database, deletedCount, pattern },
        severity: Severity.info,
      });

      res.status(200).json(response);
    } catch (error) {
      const response: RedisCommanderResponse = {
        error: error.message,
        message: 'Failed to delete keys by pattern',
        success: false,
        timestamp: new Date().toISOString(),
      };

      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: 'Error deleting keys by pattern',
        payload: { error: error.message, pattern: req.body.pattern },
        severity: Severity.error,
      });

      res.status(500).json(response);
    }
  };

  /**
   * Clear database
   */
  public clearDatabase = async (req: Request, res: Response): Promise<void> => {
    const functionName = 'clearDatabase';

    try {
      const { database = 0 } = req.query;

      const success = await this.redisCommanderService.clearDatabase(
        parseInt(database as string, 10)
      );

      const response: RedisCommanderResponse = {
        data: { cleared: success },
        message: `Database ${database} cleared successfully`,
        success,
        timestamp: new Date().toISOString(),
      };

      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: `Database ${database} cleared successfully`,
        payload: { database },
        severity: Severity.warning,
      });

      res.status(200).json(response);
    } catch (error) {
      const response: RedisCommanderResponse = {
        error: error.message,
        message: 'Failed to clear database',
        success: false,
        timestamp: new Date().toISOString(),
      };

      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: 'Error clearing database',
        payload: { error: error.message },
        severity: Severity.error,
      });

      res.status(500).json(response);
    }
  };

  /**
   * Clear all databases
   */
  public clearAllDatabases = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const functionName = 'clearAllDatabases';

    try {
      const success = await this.redisCommanderService.clearAllDatabases();

      const response: RedisCommanderResponse = {
        data: { cleared: success },
        message: 'All databases cleared successfully',
        success,
        timestamp: new Date().toISOString(),
      };

      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: 'All databases cleared successfully',
        payload: {},
        severity: Severity.warning,
      });

      res.status(200).json(response);
    } catch (error) {
      const response: RedisCommanderResponse = {
        error: error.message,
        message: 'Failed to clear all databases',
        success: false,
        timestamp: new Date().toISOString(),
      };

      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: 'Error clearing all databases',
        payload: { error: error.message },
        severity: Severity.error,
      });

      res.status(500).json(response);
    }
  };
}

// Create controller instance
const redisCommanderController = new RedisCommanderController();

// Export individual functions for use in routes
export const {
  clearAllDatabases,
  clearDatabase,
  deleteKey,
  deleteKeysByPattern,
  getDatabases,
  getKeyPatterns,
  getKeys,
  getServerInfo,
  getStats,
  getValue,
  serveInterface,
  setValue,
} = redisCommanderController;
