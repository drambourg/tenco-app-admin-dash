import { Severity } from '@google-cloud/logging';

/**
 * Interface for GCP Logger properties
 */
export interface GcpLoggerProps {
  /** Optional error object to log details from */
  error?: Error;

  /** Optional file link for source tracking */
  fileLink?: string;

  /** Message to log */
  message: string;

  /** Optional payload data to include in the log */
  payload?: any;

  /** Log severity level, defaults to 'info' */
  severity?: Severity;

  /** Whether to include Cloud Run instance information */
  withCloudRunInfos?: boolean;
}

export interface RateLimitEntry {
  count: number;
  firstLogTime: number;
  lastLogTime: number;
  suppressedCount: number;
}
