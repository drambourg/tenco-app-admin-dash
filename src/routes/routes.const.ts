import { PORT } from '../config/config';

export const API_ROUTES = {
  BULL_BOARD_CLEAN: '/bull-board/api/clean',
  BULL_BOARD_HEALTH: '/bull-board-health',
  BULL_BOARD_INTERFACE: '/bull-board',
  BULL_BOARD_STATS: '/bull-board-health',

  DASHBOARD: `/dashboard`,
  HOME: `/`,
  IOT_SIMULATOR_HEALTH: '/iot-simulator/health',
  IOT_SIMULATOR_ROOT: '/iot-simulator/',
  IOT_SIMULATOR_START_SIMULATE: '/iot-simulator/start',
  IOT_SIMULATOR_STATUS_SIMULATE: '/iot-simulator/status',
  IOT_SIMULATOR_STOP_SIMULATE: '/iot-simulator/stop',
  IOT_SIMULATOR_TEST_SIMULATE: '/iot-simulator/test',
  REDIS_COMMANDER_DATABASES: '/redis-commander/databases',
  REDIS_COMMANDER_DELETE_ALL_DATABASES: '/redis-commander/databases/clear',
  REDIS_COMMANDER_DELETE_DATABASE: '/redis-commander/database/clear',
  REDIS_COMMANDER_DELETE_KEY_PATTERN: '/redis-commander/keys/pattern',
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
