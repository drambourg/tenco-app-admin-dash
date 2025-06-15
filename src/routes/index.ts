import { Router } from 'express';

import {
  bullBoardController,
  cleanCompleted as bullCleanCompleted,
  getStats as bullGetStats,
  healthCheck as bullHealthCheck,
} from '../controllers/bull-board/bull-board.controller';
import { serveHomePage } from '../controllers/dashboard-controller';
import {
  appIotSimulator,
  healthIotSimulator,
  startIotSimulator,
  statusIotSimulator,
  stopIotSimulator,
  testIotSimulator,
} from '../controllers/iot-simulator.controller';
import {
  deleteKey,
  getDatabases,
  getKeyPatterns,
  getKeys,
  getServerInfo,
  getStats,
  getValue,
  serveInterface,
} from '../controllers/redis-commander.controller';
import { API_ROUTES } from './routes.const';

const router = Router();

// ✨ HOME DASHBOARD - Page d'accueil
router.get(API_ROUTES.HOME, serveHomePage);
router.get(API_ROUTES.DASHBOARD, serveHomePage);

router.post(API_ROUTES.IOT_SIMULATOR_STOP_SIMULATE, stopIotSimulator);
router.post(API_ROUTES.IOT_SIMULATOR_TEST_SIMULATE, testIotSimulator);
router.post(API_ROUTES.IOT_SIMULATOR_START_SIMULATE, startIotSimulator);
router.get(API_ROUTES.IOT_SIMULATOR_ROOT, appIotSimulator);
router.get(API_ROUTES.IOT_SIMULATOR_STATUS_SIMULATE, statusIotSimulator);
router.get(API_ROUTES.IOT_SIMULATOR_HEALTH, healthIotSimulator);

// Redis Commander routes
// Web interface
router.get(API_ROUTES.REDIS_COMMANDER_UI, serveInterface);

// API endpoints
router.get(API_ROUTES.REDIS_COMMANDER_INFO, getServerInfo);
router.get(API_ROUTES.REDIS_COMMANDER_STATS, getStats);
router.get(API_ROUTES.REDIS_COMMANDER_DATABASES, getDatabases);
router.get(API_ROUTES.REDIS_COMMANDER_KEYS, getKeys);
router.get(API_ROUTES.REDIS_COMMANDER_PATTERNS, getKeyPatterns);
router.get(API_ROUTES.REDIS_COMMANDER_KEY_VALUE, getValue);
router.delete(API_ROUTES.REDIS_COMMANDER_KEY_DELETE, deleteKey);

// ✨ BULL BOARD ROUTES - Job queue monitoring
router.get(API_ROUTES.BULL_BOARD_HEALTH, bullHealthCheck);
router.get(API_ROUTES.BULL_BOARD_STATS, bullGetStats);
router.post(API_ROUTES.BULL_BOARD_CLEAN, bullCleanCompleted);

router.use('/bull-board', bullBoardController.getMiddleware());

export default router;
