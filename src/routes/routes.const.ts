import { PORT } from '../config/config';

export const API_ROUTES = {
  DASHBOARD: `/dashboard`,
  HOME: `/`,
  IOT_SIMULATOR_HEALTH: '/iot-simulator/health',
  IOT_SIMULATOR_ROOT: '/iot-simulator/',
  IOT_SIMULATOR_START_SIMULATE: '/iot-simulator/start',
  IOT_SIMULATOR_STATUS_SIMULATE: '/iot-simulator/status',
  IOT_SIMULATOR_STOP_SIMULATE: '/iot-simulator/stop',
  IOT_SIMULATOR_TEST_SIMULATE: '/iot-simulator/test',
  REDIS_COMMANDER_DATABASES: '/redis-commander/databases',
  REDIS_COMMANDER_INFO: '/redis-commander/info',
  REDIS_COMMANDER_KEYS: '/redis-commander/keys',
  REDIS_COMMANDER_KEY_DELETE: '/redis-commander/key/:key',
  REDIS_COMMANDER_KEY_VALUE: '/redis-commander/key/:key',
  REDIS_COMMANDER_PATTERNS: '/redis-commander/patterns',
  REDIS_COMMANDER_STATS: '/redis-commander/stats',
  REDIS_COMMANDER_UI: '/redis-commander',
};

export const SERVER = {
  BODY_LIMIT: '10mb',
  DEFAULT_PORT: 8080,
  DEV_PORT: Number(PORT),
};

export const FUNCTION_NAMES = {
  ADMIN_APP: 'admin-app',
};
