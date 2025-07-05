/* eslint-disable sort-keys-fix/sort-keys-fix */
import { PORT } from '../config/config';

export const API_ROUTES = {
  BULL_BOARD_CLEAN: '/bull-board/api/clean',
  BULL_BOARD_HEALTH: '/bull-board-health',
  BULL_BOARD_INTERFACE: '/bull-board',
  BULL_BOARD_STATS: '/bull-board-health',

  DASHBOARD: `/dashboard`,

  EMQX_HEALTH: '/emqx/health',
  EMQX_INTERFACE: '/emqx',
  EMQX_STATS: '/emqx/stats',
  EMQX_TEST_PUBLISH: '/emqx/test/publish',
  EMQX_TEST_RECONNECT: '/emqx/test/reconnect',

  EMQX_IOT_SIMULATOR_HEALTH: '/emqx-iot-simulator/health',
  EMQX_IOT_SIMULATOR_MAC_ADDRESSES: '/emqx-iot-simulator/mac-addresses',
  EMQX_IOT_SIMULATOR_RESET_TIMELINE: '/emqx-iot-simulator/reset-timeline',
  EMQX_IOT_SIMULATOR_ROOT: '/emqx-iot-simulator/',
  EMQX_IOT_SIMULATOR_START_SIMULATE: '/emqx-iot-simulator/start',
  EMQX_IOT_SIMULATOR_STATUS_SIMULATE: '/emqx-iot-simulator/status',
  EMQX_IOT_SIMULATOR_STOP_SIMULATE: '/emqx-iot-simulator/stop',
  EMQX_IOT_SIMULATOR_TEST_SIMULATE: '/emqx-iot-simulator/test',
  EMQX_IOT_SIMULATOR_TIMELINE_INFO: '/emqx-iot-simulator/timeline-info',
  EMQX_DIAGNOSTICS: '/emqx/diagnostics',
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
