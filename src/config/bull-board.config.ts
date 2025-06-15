/**
 * Bull Board Configuration
 * Centralized configuration for queue monitoring
 */

export const BULL_BOARD_CONFIG = {
  // Allowed actions configuration
  ACTIONS: {
    ALLOW_CLEAN: true,
    ALLOW_JOB_REMOVAL: true,
    ALLOW_PAUSE_RESUME: true,
    ALLOW_RETRY: true,
  },

  // Monitoring configuration
  MONITORING: {
    // Max jobs displayed per state
    ENABLE_METRICS: true,

    // Refresh every 5 seconds
    MAX_JOBS_DISPLAY: 100,
    REFRESH_INTERVAL: 5000,
  },

  // Main queue configuration
  QUEUE: {
    NAME: 'processed-datapoint-batch',
    PREFIX: 'bull', // Redis prefix for Bull queues
  },

  // Statistics configuration
  STATS: {
    ENABLE_COMPLETED_STATS: true,
    ENABLE_FAILED_STATS: true,
    STATS_RETENTION_DAYS: 7,
  },

  // Bull Board UI configuration
  UI: {
    BASE_PATH: '/bull-board',
    FAVICON_PATH: undefined,
    TITLE: 'Queue Monitor', // Use default favicon
  },
} as const;

// Configuration types
export type BullBoardQueueConfig = typeof BULL_BOARD_CONFIG.QUEUE;
export type BullBoardUIConfig = typeof BULL_BOARD_CONFIG.UI;
export type BullBoardMonitoringConfig = typeof BULL_BOARD_CONFIG.MONITORING;
