import * as os from 'os';

import { Logging, Severity } from '@google-cloud/logging';

import { AppError } from '../error';
import { GcpLoggerProps } from './gcp.interface';

// Create a singleton logging client
const loggingClient = new Logging({
  // Standard options only - the 'timeout' option isn't available in LoggingOptions
  projectId: process.env.GCP_PROJECT_ID,
});
const logName = process.env.GCP_LOGGER_NAME || 'tenco-api-logger';
const logger = loggingClient.log(logName);

// Queue for logging
const logQueue = [];
let isProcessingLogs = false;

/**
 * Process the log queue in batch mode
 */
async function processLogQueue() {
  if (isProcessingLogs || logQueue.length === 0) return;

  isProcessingLogs = true;
  try {
    const batch = logQueue.splice(0, 50); // Process in batches of up to 50 logs
    await logger.write(batch);
  } catch (error) {
    console.error('Error writing logs to Cloud Logging:', error.message);
  } finally {
    isProcessingLogs = false;
    if (logQueue.length > 0) {
      setImmediate(processLogQueue);
    }
  }
}

/**
 * Gets the current instance information for Cloud Run
 * @returns {Object} Object containing instance ID, CPU usage, and memory usage
 */
function getCloudRunInstanceInfo() {
  // Get Cloud Run instance ID from environment variables
  const instanceId = process.env.K_REVISION || 'unknown-instance';

  // Get CPU information
  const cpuCount = os.cpus().length;
  const cpuUsage = process.cpuUsage();
  const cpuUsagePercent = ((cpuUsage.user + cpuUsage.system) / 1000000).toFixed(
    2
  );

  // Get memory information
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

/**
 * Logs a message to Google Cloud Platform (GCP) logging.
 *
 * @param {GcpLoggerProps} props - Logging properties including fileLink, message, and severity.
 * @param {boolean} props.withCloudRunInfos - Whether to include Cloud Run instance information.
 */
function gcpLogger({
  correlationId = undefined,
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
}) {
  if (
    isDebugLog &&
    process.env.DEBUG !== '1' &&
    process.env.NODE_ENV !== 'development'
  )
    return;

  try {
    // Prepare the log data
    const logData: any = {
      fileLink,
      message,
      timestamp: new Date(),
    };

    // Add correlation ID if provided
    if (correlationId) {
      logData.correlationId = correlationId;
    }

    // If a payload is provided, add it
    if (payload) {
      logData.payload = payload;
    }

    // Add Cloud Run instance information if requested
    if (withCloudRunInfos) {
      logData.cloudRunInstance = getCloudRunInstanceInfo();
    }

    // If an error is provided, extract its details
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

    // Check if we're in development environment
    if (process.env.NODE_ENV === 'development') {
      const severityPrefix = `[${severity}]`;

      // Format the output based on severity
      if (severity === Severity.critical || severity === Severity.error) {
        console.error(severityPrefix, message, logData);
      } else if (severity === Severity.warning) {
        console.warn(severityPrefix, message, logData);
      } else if (severity === Severity.debug) {
        console.debug(severityPrefix, message, logData);
      } else {
        console.log(severityPrefix, message, logData);
      }
    }

    const entry = logger.entry({
      data: logData,
      message,
      resource: { type: 'global' },
      severity,
    });

    // Add to queue instead of writing immediately
    logQueue.push(entry);

    // Trigger queue processing if not already in progress
    if (!isProcessingLogs) {
      setImmediate(processLogQueue);
    }

    // For critical errors, also print to console
    if (process.env.NODE_ENV === 'development') {
      if (severity === Severity.critical || severity === Severity.error) {
        console.error(`[${severity}] ${message}`);
      }
    }
  } catch (logError) {
    // In case of an error in logging itself, don't block the application
    console.error('Error preparing log entry:', logError);
  }
}

// Export the gcpLogger function
export default gcpLogger;
