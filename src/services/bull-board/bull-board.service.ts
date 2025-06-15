/* eslint-disable no-underscore-dangle */
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Severity } from '@google-cloud/logging';
import Bull from 'bull';

import { BULL_BOARD_CONFIG } from '../../config/bull-board.config';
import gcpLogger from '../../utils/gcp/gcp-logger';
import { getRedisClient } from '../../utils/redis/redis-client';

/**
 * Bull Board Service
 * Manages Bull queue monitoring with existing Redis client reuse
 */
class BullBoardService {
  // eslint-disable-next-line no-use-before-define
  private static instance: BullBoardService;
  private bullQueue: Bull.Queue | null = null;
  private serverAdapter: ExpressAdapter | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  public static getInstance(): BullBoardService {
    if (!BullBoardService.instance) {
      BullBoardService.instance = new BullBoardService();
    }
    return BullBoardService.instance;
  }

  /**
   * Initialize Bull Board with existing Redis client
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // If initialization is already in progress, wait for it
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._doInitialization();
    return this.initializationPromise;
  }

  private async _doInitialization(): Promise<void> {
    try {
      gcpLogger({
        fileLink: __filename,
        message: 'Initializing Bull Board service',
        payload: {
          basePath: BULL_BOARD_CONFIG.UI.BASE_PATH,
          queueName: BULL_BOARD_CONFIG.QUEUE.NAME,
        },
        severity: Severity.info,
      });

      // Reuse existing Redis client
      const redisClient = await getRedisClient();

      // Create Bull queue reusing Redis configuration
      this.bullQueue = new Bull(BULL_BOARD_CONFIG.QUEUE.NAME, {
        prefix: BULL_BOARD_CONFIG.QUEUE.PREFIX,
        redis: {
          db: redisClient.options.db || 0,
          host: redisClient.options.host || 'localhost',
          password: redisClient.options.password,
          port: redisClient.options.port || 6379,
        },
        settings: {
          maxStalledCount: 1,
          stalledInterval: 30000,
        },
      });

      // Configure Bull Board
      this.serverAdapter = new ExpressAdapter();
      this.serverAdapter.setBasePath(BULL_BOARD_CONFIG.UI.BASE_PATH);

      // Create Bull Board dashboard
      createBullBoard({
        options: {
          uiConfig: {
            boardTitle: BULL_BOARD_CONFIG.UI.TITLE,
          },
        },
        queues: [new BullAdapter(this.bullQueue)],
        serverAdapter: this.serverAdapter,
      });

      // Configure event listeners for logging
      this.setupEventListeners();

      this.isInitialized = true;

      gcpLogger({
        fileLink: __filename,
        message: 'Bull Board service initialized successfully',
        payload: {
          queueName: BULL_BOARD_CONFIG.QUEUE.NAME,
          redisHost: redisClient.options.host,
          redisPort: redisClient.options.port,
        },
        severity: Severity.info,
      });
    } catch (error) {
      gcpLogger({
        fileLink: __filename,
        message: 'Error initializing Bull Board service',
        payload: {
          error: error.message,
          stack: error.stack,
        },
        severity: Severity.error,
      });
      throw new Error(`Failed to initialize Bull Board: ${error.message}`);
    }
  }

  /**
   * Get Express middleware for Bull Board (with lazy initialization)
   */
  public async getMiddleware() {
    // Lazy initialization if not already done
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.serverAdapter) {
      throw new Error('Bull Board server adapter not available');
    }

    return this.serverAdapter.getRouter();
  }

  /**
   * Get Express middleware synchronously (returns a middleware that initializes on first request)
   */
  public getMiddlewareSync() {
    return async (req: any, res: any, next: any) => {
      try {
        // Initialize if not already done
        if (!this.isInitialized) {
          await this.initialize();
        }

        if (!this.serverAdapter) {
          return res.status(503).json({
            error: 'Bull Board service not available',
            message: 'Bull Board is not properly initialized',
            success: false,
          });
        }

        // Get the router and handle the request
        const router = this.serverAdapter.getRouter();
        return router(req, res, next);
      } catch (error) {
        gcpLogger({
          fileLink: __filename,
          message: 'Error in Bull Board middleware',
          payload: { error: error.message },
          severity: Severity.error,
        });

        return res.status(503).json({
          error: 'Bull Board service error',
          message: error.message,
          success: false,
        });
      }
    };
  }

  /**
   * Get queue statistics
   */
  public async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
  }> {
    if (!this.bullQueue) {
      throw new Error('Bull queue not initialized');
    }

    try {
      const [waiting, active, completed, failed, delayed, paused] =
        await Promise.all([
          this.bullQueue.getWaiting(),
          this.bullQueue.getActive(),
          this.bullQueue.getCompleted(),
          this.bullQueue.getFailed(),
          this.bullQueue.getDelayed(),
          this.bullQueue.isPaused(),
        ]);

      return {
        active: active.length,
        completed: completed.length,
        delayed: delayed.length,
        failed: failed.length,
        paused,
        waiting: waiting.length,
      };
    } catch (error) {
      gcpLogger({
        fileLink: __filename,
        message: 'Error getting queue statistics',
        payload: { error: error.message },
        severity: Severity.error,
      });
      throw error;
    }
  }

  /**
   * Get queue health status
   */
  public async getHealth(): Promise<{
    healthy: boolean;
    queueName: string;
    connected: boolean;
    stats?: any;
    error?: string;
  }> {
    try {
      if (!this.bullQueue) {
        return {
          connected: false,
          error: 'Queue not initialized',
          healthy: false,
          queueName: BULL_BOARD_CONFIG.QUEUE.NAME,
        };
      }

      // Test connection by retrieving stats
      const stats = await this.getQueueStats();

      return {
        connected: true,
        healthy: true,
        queueName: BULL_BOARD_CONFIG.QUEUE.NAME,
        stats,
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        healthy: false,
        queueName: BULL_BOARD_CONFIG.QUEUE.NAME,
      };
    }
  }

  /**
   * Clean completed jobs (utility method)
   */
  public async cleanCompletedJobs(
    maxAge: number = 24 * 60 * 60 * 1000
  ): Promise<number> {
    if (!this.bullQueue) {
      throw new Error('Bull queue not initialized');
    }

    try {
      const cleaned = await this.bullQueue.clean(maxAge, 'completed');

      gcpLogger({
        fileLink: __filename,
        message: 'Cleaned completed jobs',
        payload: {
          jobsCleaned: cleaned.length,
          maxAge,
          queueName: BULL_BOARD_CONFIG.QUEUE.NAME,
        },
        severity: Severity.info,
      });

      return cleaned.length;
    } catch (error) {
      gcpLogger({
        fileLink: __filename,
        message: 'Error cleaning completed jobs',
        payload: { error: error.message },
        severity: Severity.error,
      });
      throw error;
    }
  }

  /**
   * Setup event listeners for monitoring
   */
  private setupEventListeners(): void {
    if (!this.bullQueue) return;

    // Log important queue events
    this.bullQueue.on('error', (error) => {
      gcpLogger({
        fileLink: __filename,
        message: 'Bull queue error',
        payload: {
          error: error.message,
          queueName: BULL_BOARD_CONFIG.QUEUE.NAME,
        },
        severity: Severity.error,
      });
    });

    this.bullQueue.on('waiting', (jobId) => {
      gcpLogger({
        fileLink: __filename,
        message: 'Job waiting',
        payload: {
          jobId,
          queueName: BULL_BOARD_CONFIG.QUEUE.NAME,
        },
        severity: Severity.debug,
      });
    });

    this.bullQueue.on('stalled', (job) => {
      gcpLogger({
        fileLink: __filename,
        message: 'Job stalled',
        payload: {
          jobId: job.id,
          jobType: job.name,
          queueName: BULL_BOARD_CONFIG.QUEUE.NAME,
        },
        severity: Severity.warning,
      });
    });

    this.bullQueue.on('failed', (job, error) => {
      gcpLogger({
        fileLink: __filename,
        message: 'Job failed',
        payload: {
          error: error.message,
          jobId: job.id,
          jobType: job.name,
          queueName: BULL_BOARD_CONFIG.QUEUE.NAME,
        },
        severity: Severity.warning,
      });
    });
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    try {
      if (this.bullQueue) {
        await this.bullQueue.close();
        this.bullQueue = null;
      }
      this.serverAdapter = null;
      this.isInitialized = false;
      this.initializationPromise = null;

      gcpLogger({
        fileLink: __filename,
        message: 'Bull Board service cleaned up',
        payload: {},
        severity: Severity.info,
      });
    } catch (error) {
      gcpLogger({
        fileLink: __filename,
        message: 'Error during Bull Board cleanup',
        payload: { error: error.message },
        severity: Severity.error,
      });
    }
  }
}

export default BullBoardService;
