import { PORT } from '../config/config';

export const API_ROUTES = {
  HEALTH: '/iot-simulator/health',
  ROOT: '/iot-simulator/',
  START_SIMULATE: '/iot-simulator/start',
  STATUS_SIMULATE: '/iot-simulator/status',
  STOP_SIMULATE: '/iot-simulator/stop',
  TEST_SIMULATE: '/iot-simulator/test',
};

export const SERVER = {
  BODY_LIMIT: '10mb',
  DEFAULT_PORT: 8080,
  DEV_PORT: Number(PORT),
};

export const FUNCTION_NAMES = {
  IOT_SIMULATOR: 'iot-simulator',
};
