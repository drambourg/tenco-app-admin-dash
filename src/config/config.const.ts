import { HTTP_CODES } from '../utils/error';

export const LOG_MESSAGES = {
  DEV_SERVER_STARTED: (port: number) =>
    `Development server listening on port ${port}`,
  ENV_VALIDATED: 'Environment variables validated successfully',
  ENV_VALIDATION_FAILED: 'Failed to validate environment variables',
  REDIS_ERROR: 'Redis connection error',
  REDIS_INIT_FAILED: 'Failed to initialize Redis client',
  SERVER_STARTED: (port: number) => `Server listening on port ${port}`,
  SHUTDOWN_ERROR: 'Error during shutdown',
  SHUTDOWN_INITIATED: 'Server shutdown initiated...',
  SIMULATE_SUCCESS: (macAddress: string) =>
    `Successfully iot simulate device: ${macAddress}`,
};

export const API_RESPONSES = {
  METHOD_NOT_ALLOWED: {
    message: 'Method Not Allowed. Only POST requests are accepted.',
    status: HTTP_CODES.METHOD_NOT_ALLOWED,
  },
  SIMULATE_SUCCESS: {
    message: 'Iot Simulator Function works',
  },
};
