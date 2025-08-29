import * as os from 'os';

import { Entry, Logging, Severity } from '@google-cloud/logging';

import { AppError } from '../error';
import { RATE_LIMIT_CONFIG } from './gcp.config';
import { GcpLoggerProps, RateLimitEntry } from './gcp.interface';

const isDevEnvironment = process.env.NODE_ENV === 'development';
// Create a singleton logging client
const loggingClient = !isDevEnvironment
  ? new Logging({ projectId: process.env.GCP_PROJECT_ID })
  : null;
const logName = process.env.GCP_LOGGER_NAME || 'tenco-app-update-iot-device';
const logger = !isDevEnvironment ? loggingClient?.log(logName) : null;

// Queue for logging
const logQueue: Entry[] = [];
let isProcessingLogs = false;
let logFailures = 0;
let circuitOpenUntil = 0;
let currentBatch: Entry[] = [];
const MAX_LOG_QUEUE_SIZE = 10000;
const rateLimitMap = new Map<string, RateLimitEntry>();

if (!isDevEnvironment) {
  // Cleanup old rate limit entries periodically
  setInterval(() => {
    try {
      const now = Date.now();
      const cutoff = now - RATE_LIMIT_CONFIG.WINDOW_MS * 2;

      if (rateLimitMap.size > RATE_LIMIT_CONFIG.MAX_MAP_SIZE) {
        console.warn(
          `Rate limit map size exceeded ${RATE_LIMIT_CONFIG.MAX_MAP_SIZE}, clearing all entries`
        );
        rateLimitMap.clear();
        return;
      }

      for (const [key, entry] of rateLimitMap) {
        if (entry.lastLogTime < cutoff) {
          rateLimitMap.delete(key);
        }
      }
    } catch (cleanupError) {
      console.error('Error during rate limit cleanup:', cleanupError);
      rateLimitMap.clear();
    }
  }, RATE_LIMIT_CONFIG.CLEANUP_INTERVAL_MS);
}

/**
 * Create a simple hash for rate limiting key
 */
function createRateLimitKey(message: string, severity: Severity): string {
  try {
    const messageKey = message
      .substring(0, 20)
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();
    return `${messageKey}_${severity}`.substring(0, 50);
  } catch (error) {
    return `fallback_${severity}_${Date.now()}`;
  }
}

/**
 * Check if log should be rate limited
 */
function checkRateLimit(
  message: string,
  severity: Severity
): {
  shouldLog: boolean;
  rateLimitInfo?: { suppressedCount: number; timeWindow: string };
} {
  try {
    const key = createRateLimitKey(message, severity);
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_CONFIG.WINDOW_MS;

    const entry = rateLimitMap.get(key);

    if (!entry) {
      rateLimitMap.set(key, {
        count: 1,
        firstLogTime: now,
        lastLogTime: now,
        suppressedCount: 0,
      });
      return { shouldLog: true };
    }

    if (entry.firstLogTime < windowStart) {
      if (entry.suppressedCount > 0) {
        try {
          const summaryMessage = `[RATE LIMIT SUMMARY] Suppressed ${
            entry.suppressedCount
          } similar logs in last ${Math.round(
            RATE_LIMIT_CONFIG.WINDOW_MS / 1000
          )}s: "${message.substring(0, 50)}..."`;

          const summaryEntry = logger.entry({
            data: {
              message: summaryMessage,
              originalMessage: message.substring(0, 100),
              rateLimitInfo: {
                originalSeverity: severity,
                suppressedCount: entry.suppressedCount,
                timeWindow: `${Math.round(
                  RATE_LIMIT_CONFIG.WINDOW_MS / 1000
                )}s`,
              },
              timestamp: new Date(),
            },
            resource: { type: 'global' },
            severity: Severity.info,
          });

          logQueue.push(summaryEntry);
        } catch (summaryError) {
          console.error('Error creating rate limit summary:', summaryError);
        }
      }

      rateLimitMap.set(key, {
        count: 1,
        firstLogTime: now,
        lastLogTime: now,
        suppressedCount: 0,
      });
      return { shouldLog: true };
    }

    entry.lastLogTime = now;

    if (entry.count >= RATE_LIMIT_CONFIG.MAX_LOGS_PER_WINDOW) {
      entry.suppressedCount += 1;
      return {
        rateLimitInfo: {
          suppressedCount: entry.suppressedCount,
          timeWindow: `${Math.round(RATE_LIMIT_CONFIG.WINDOW_MS / 1000)}s`,
        },
        shouldLog: false,
      };
    }

    entry.count += 1;
    return { shouldLog: true };
  } catch (rateLimitError) {
    console.error(
      'Error in rate limiting logic, allowing log:',
      rateLimitError
    );
    return { shouldLog: true };
  }
}

async function processBatchIndividually(failedBatch: Entry[]) {
  if (isDevEnvironment) return;

  if (!failedBatch || failedBatch.length === 0) {
    console.warn('[processBatchIndividually] No failed batch provided');
    return;
  }

  console.warn(
    `[processBatchIndividually] Processing ${failedBatch.length} failed entries individually`
  );

  for (const [index, entry] of failedBatch.entries()) {
    try {
      await logger.write([entry]);
    } catch (error: any) {
      console.error(
        `[processBatchIndividually] Failed to write entry ${index + 1}/${
          failedBatch.length
        }:`,
        error.message
      );

      const entrySeverity = entry.metadata?.severity;
      if (entrySeverity !== 'CRITICAL' && entrySeverity !== 'ERROR') {
        console.error('[GCP FALLBACK - CRITICAL]', entry.data);
      }
    }
  }
}

async function processLogQueue() {
  // 1. Early returns
  if (isDevEnvironment) return;
  if (isProcessingLogs || logQueue.length === 0) return;

  if (Date.now() < circuitOpenUntil) {
    const waitTime = circuitOpenUntil - Date.now();
    setTimeout(() => {
      if (logQueue.length > 0) {
        setImmediate(processLogQueue);
      }
    }, Math.min(waitTime, 5000)); // Max 5s wait
    return;
  }

  // 3. Set processing lock
  isProcessingLogs = true;

  try {
    const batch = logQueue.slice(0, 5);
    currentBatch = [...batch];

    if (batch.length === 0) {
      return; // Safety check
    }

    // Create write promise with timeout
    const writePromise = logger.write(batch);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Log write timeout')), 30000);
    });

    // Attempt to write the batch
    await Promise.race([writePromise, timeoutPromise]);

    logQueue.splice(0, 5);
    currentBatch = [];

    logFailures = 0;
  } catch (error: any) {
    console.error(
      '[processLogQueue] Error writing logs to Cloud Logging:',
      error.message
    );

    logFailures += 1;

    if (logFailures >= 3) {
      const backoffTime = Math.min(1000 * 2 ** (logFailures - 3), 60000); // Exponential backoff
      circuitOpenUntil = Date.now() + backoffTime;

      console.error(
        `[CIRCUIT BREAKER] Log writer failed ${logFailures} times. Opening circuit for ${
          backoffTime / 1000
        }s. Queue size: ${logQueue.length}`
      );
    }

    if (
      error.message.includes('timeout') ||
      error.message.includes('exceeded')
    ) {
      console.warn(
        '[processLogQueue] Batch write timed out, trying individual writes'
      );
      await processBatchIndividually(currentBatch);

      logQueue.splice(0, 5);
    } else {
      console.warn(
        `[processLogQueue] Non-timeout error, keeping batch for retry`
      );
    }

    // Clear current batch backup
    currentBatch = [];
  } finally {
    isProcessingLogs = false;

    if (logQueue.length > 0) {
      if (Date.now() < circuitOpenUntil) {
        const waitTime = circuitOpenUntil - Date.now();
        setTimeout(() => {
          setImmediate(processLogQueue);
        }, Math.min(waitTime, 5000));
      } else {
        const delay =
          logFailures > 0 ? Math.min(1000 * logFailures, 5000) : 100;
        setTimeout(() => {
          setImmediate(processLogQueue);
        }, delay);
      }
    }
  }
}

/**
 * Gets the current instance information for Cloud Run
 */
function getCloudRunInstanceInfo() {
  const instanceId = process.env.K_REVISION || 'unknown-instance';

  const cpuCount = os.cpus().length;
  const cpuUsage = process.cpuUsage();
  const cpuUsagePercent = ((cpuUsage.user + cpuUsage.system) / 1000000).toFixed(
    2
  );

  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsagePercent = ((usedMemory / totalMemory) * 100).toFixed(2);

  return {
    cpu: {
      count: cpuCount,
      usage: `${cpuUsagePercent}%`,
    },
    instanceId,
    memory: {
      percent: `${memoryUsagePercent}%`,
      total: `${Math.round(totalMemory / 1024 / 1024)} MB`,
      used: `${Math.round(usedMemory / 1024 / 1024)} MB`,
    },
  };
}

const toDebug = process.env.DEBUG === '1' || isDevEnvironment;

function gcpLogger({
  correlationId = undefined,
  enableRateLimit = false,
  error,
  fileLink,
  isDebugLog = false,
  message,
  payload,
  severity = Severity.info,
  withCloudRunInfos = false,
}: GcpLoggerProps & {
  withCloudRunInfos?: boolean;
  correlationId?: string;
  isDebugLog?: boolean;
  enableRateLimit?: boolean;
}) {
  if (isDebugLog && !toDebug) return;

  if (Date.now() < circuitOpenUntil && severity !== Severity.critical) {
    return;
  }

  if (enableRateLimit) {
    try {
      const rateLimitResult = checkRateLimit(message, severity);

      if (!rateLimitResult.shouldLog) {
        return;
      }
    } catch (rateLimitError) {
      console.error(
        'Rate limiting failed, proceeding with normal log:',
        rateLimitError
      );
    }
  }

  try {
    const logData: any = {
      fileLink,
      message,
      timestamp: new Date(),
    };

    if (correlationId) logData.correlationId = correlationId;
    if (payload) logData.payload = payload;
    if (withCloudRunInfos) logData.cloudRunInstance = getCloudRunInstanceInfo();
    if (error) {
      logData.errorDetails = {
        message: error.message,
        name: error.name,
        stack: error.stack,
      };

      if (error instanceof AppError) {
        logData.errorDetails.statusCode = error.statusCode;
        logData.errorDetails.code = error.name;
      }
    }

    if (isDevEnvironment) {
      const severityPrefix = `[${severity}]`;

      if (severity === Severity.critical || severity === Severity.error) {
        console.error(severityPrefix, message, logData);
      } else if (severity === Severity.warning) {
        console.warn(severityPrefix, message, logData);
      } else if (severity === Severity.debug) {
        console.debug(severityPrefix, message, logData);
      } else {
        console.log(severityPrefix, message, logData);
      }
      return;
    }

    const entry = logger.entry({
      data: logData,
      message,
      resource: { type: 'global' },
      severity,
    });

    if (logQueue.length >= MAX_LOG_QUEUE_SIZE) {
      if (severity === Severity.critical || severity === Severity.error) {
        let removed = 0;
        for (let i = 0; i < logQueue.length && removed < 10; i += 1) {
          const existingEntry = logQueue[i];
          const entrySeverity = existingEntry.metadata?.severity;
          if (entrySeverity !== 'CRITICAL' && entrySeverity !== 'ERROR') {
            logQueue.splice(i, 1);
            removed += 1;
            i -= 1; // Adjust index after removal
          }
        }

        if (removed > 0) {
          console.warn(
            `[QUEUE MANAGEMENT] Removed ${removed} non-critical logs to make space for critical log`
          );
        }

        logQueue.push(entry);
      } else {
        console.warn(
          `[QUEUE OVERFLOW] Non-critical log ignored. Queue size: ${logQueue.length}`
        );

        return;
      }
    } else {
      logQueue.push(entry);
    }

    if (!isProcessingLogs && Date.now() >= circuitOpenUntil) {
      setImmediate(processLogQueue);
    }
  } catch (logError: any) {
    console.error('Error preparing log entry:', logError);

    if (severity === Severity.critical || severity === Severity.error) {
      console.error('[EMERGENCY FALLBACK]', message, payload);
    }
  }
}

export function getLoggerStatus() {
  return {
    circuitOpen: Date.now() < circuitOpenUntil,
    circuitRemainingMs: Math.max(0, circuitOpenUntil - Date.now()),
    currentBatchSize: currentBatch.length,
    failures: logFailures,
    isProcessing: isProcessingLogs,
    queueSize: logQueue.length,
  };
}

export default gcpLogger;
