import { Severity } from '@google-cloud/logging';
import { Request, Response } from 'express';

import { BULL_BOARD_CONFIG } from '../../config/bull-board.config';
import BullBoardService from '../../services/bull-board/bull-board.service';
import gcpLogger from '../../utils/gcp/gcp-logger';

export class BullBoardController {
  private bullBoardService: BullBoardService;

  constructor() {
    this.bullBoardService = BullBoardService.getInstance();
  }

  /**
   * Initialize Bull Board service
   */
  public async initializeService(): Promise<void> {
    await this.bullBoardService.initialize();
  }

  /**
   * Get Bull Board middleware for mounting (synchronous version)
   */
  public getMiddleware() {
    return this.bullBoardService.getMiddlewareSync();
  }

  /**
   * Health check endpoint for Bull Board
   */
  public healthCheck = async (req: Request, res: Response): Promise<void> => {
    const functionName = 'healthCheck';

    try {
      const health = await this.bullBoardService.getHealth();

      const statusCode = health.healthy ? 200 : 503;

      res.status(statusCode).json({
        data: {
          connected: health.connected,
          error: health.error,
          queueName: health.queueName,
          stats: health.stats,
        },
        message: health.healthy
          ? 'Bull Board is healthy'
          : 'Bull Board is unhealthy',
        success: health.healthy,
        timestamp: new Date().toISOString(),
      });

      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: `Bull Board health check: ${
          health.healthy ? 'healthy' : 'unhealthy'
        }`,
        payload: {
          connected: health.connected,
          error: health.error,
          healthy: health.healthy,
          queueName: health.queueName,
        },
        severity: health.healthy ? Severity.info : Severity.warning,
      });
    } catch (error) {
      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: 'Error during Bull Board health check',
        payload: { error: error.message },
        severity: Severity.error,
      });

      res.status(500).json({
        error: error.message,
        message: 'Bull Board health check failed',
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Get queue statistics API endpoint
   */
  public getStats = async (req: Request, res: Response): Promise<void> => {
    const functionName = 'getStats';

    try {
      const stats = await this.bullBoardService.getQueueStats();

      res.status(200).json({
        data: {
          queueName: BULL_BOARD_CONFIG.QUEUE.NAME,
          stats,
          timestamp: new Date().toISOString(),
        },
        message: 'Queue statistics retrieved successfully',
        success: true,
      });

      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: 'Queue statistics retrieved',
        payload: {
          queueName: BULL_BOARD_CONFIG.QUEUE.NAME,
          stats,
        },
        severity: Severity.info,
      });
    } catch (error) {
      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: 'Error retrieving queue statistics',
        payload: { error: error.message },
        severity: Severity.error,
      });

      res.status(500).json({
        error: error.message,
        message: 'Failed to retrieve queue statistics',
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Clean completed jobs endpoint
   */
  public cleanCompleted = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const functionName = 'cleanCompleted';

    try {
      // Get max age from query params (default: 24h)
      const maxAgeHours = parseInt(req.query.maxAge as string, 10) || 24;
      const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

      const cleaned = await this.bullBoardService.cleanCompletedJobs(maxAgeMs);

      res.status(200).json({
        data: {
          jobsCleaned: cleaned,
          maxAgeHours,
          queueName: BULL_BOARD_CONFIG.QUEUE.NAME,
        },
        message: `Successfully cleaned ${cleaned} completed jobs`,
        success: true,
        timestamp: new Date().toISOString(),
      });

      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: 'Completed jobs cleaned',
        payload: {
          jobsCleaned: cleaned,
          maxAgeHours,
          queueName: BULL_BOARD_CONFIG.QUEUE.NAME,
        },
        severity: Severity.info,
      });
    } catch (error) {
      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: 'Error cleaning completed jobs',
        payload: { error: error.message },
        severity: Severity.error,
      });

      res.status(500).json({
        error: error.message,
        message: 'Failed to clean completed jobs',
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Serve Bull Board interface with custom landing page
   */
  public serveInterface = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const functionName = 'serveInterface';

    try {
      // Check if Bull Board is healthy before redirecting
      const health = await this.bullBoardService.getHealth();

      if (!health.healthy) {
        // Show error page if Bull Board is not available
        res
          .status(503)
          .send(
            this.getErrorPageHTML(
              health.error || 'Bull Board service unavailable'
            )
          );
        return;
      }

      // Redirect to Bull Board interface (remove /queues)
      res.redirect(`${BULL_BOARD_CONFIG.UI.BASE_PATH}`);

      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: 'Bull Board interface accessed',
        payload: { userAgent: req.get('User-Agent') },
        severity: Severity.info,
      });
    } catch (error) {
      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: 'Error serving Bull Board interface',
        payload: { error: error.message },
        severity: Severity.error,
      });

      res.status(500).send(this.getErrorPageHTML(error.message));
    }
  };

  /**
   * Generate error page HTML when Bull Board is unavailable
   */
  // eslint-disable-next-line class-methods-use-this
  private getErrorPageHTML(errorMessage: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bull Board - Service Unavailable</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
            .home-link { position: absolute; left: 30px; top: 50%; transform: translateY(-50%); color: white; text-decoration: none; font-size: 2rem; transition: transform 0.3s ease; }
.home-link:hover { transform: translateY(-50%) scale(1.2); color: #f0f0f0; }
        .container {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            max-width: 500px;
        }
        .icon {
            font-size: 4rem;
            margin-bottom: 1rem;
        }
        .title {
            color: #2d3748;
            margin-bottom: 1rem;
            font-size: 1.5rem;
        }
        .message {
            color: #718096;
            margin-bottom: 1.5rem;
            line-height: 1.6;
        }
        .error {
            background: #fed7d7;
            border: 1px solid #feb2b2;
            color: #c53030;
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 1.5rem;
            font-family: monospace;
            font-size: 0.9rem;
        }
        .button {
            background: #667eea;
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            text-decoration: none;
            display: inline-block;
            margin: 0.5rem;
        }
        .button:hover {
            background: #5a67d8;
        }
    </style>
</head>
<body>
    <div class="container">
        <a href="/" class="home-link" title="Retour à l'accueil">🏠</a>
        <div class="icon">📊</div>
        <h1 class="title">Bull Board Unavailable</h1>
        <p class="message">
            The job queue monitoring service is currently unavailable. 
            This might be due to a connection issue with Redis or the queue service.
        </p>
        <div class="error">
            Error: ${errorMessage}
        </div>
        <a href="/bull-board-health" class="button">Check Health</a>
        <a href="/" class="button">Back to Dashboard</a>
    </div>
</body>
</html>
    `;
  }
}

// Export singleton
const bullBoardController = new BullBoardController();

export const { cleanCompleted, getStats, healthCheck, serveInterface } =
  bullBoardController;

export { bullBoardController };
