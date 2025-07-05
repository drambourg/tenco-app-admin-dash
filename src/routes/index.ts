import { Router } from 'express';

import {
  bullBoardController,
  cleanCompleted as bullCleanCompleted,
  getStats as bullGetStats,
  healthCheck as bullHealthCheck,
} from '../controllers/bull-board/bull-board.controller';
import { serveHomePage } from '../controllers/dashboard-controller';
import EmqxIoTSimulatorController from '../controllers/emqx-iot-simulator.controller';
import {
  getEmqxDiagnostics,
  getEmqxStats,
  healthEmqx,
  serveEmqxInterface,
  testPublish,
  testReconnect,
} from '../controllers/emqx.controller';
import {
  appIotSimulator,
  healthIotSimulator,
  startIotSimulator,
  statusIotSimulator,
  stopIotSimulator,
  testIotSimulator,
} from '../controllers/iot-simulator.controller';
import {
  clearAllDatabases,
  clearDatabase,
  deleteKey,
  deleteKeysByPattern,
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
const emqxIoTSimulatorController = new EmqxIoTSimulatorController();

// ✨ HOME DASHBOARD - Page d'accueil
router.get(API_ROUTES.HOME, serveHomePage);
router.get(API_ROUTES.DASHBOARD, serveHomePage);

router.post(API_ROUTES.IOT_SIMULATOR_STOP_SIMULATE, stopIotSimulator);
router.post(API_ROUTES.IOT_SIMULATOR_TEST_SIMULATE, testIotSimulator);
router.post(API_ROUTES.IOT_SIMULATOR_START_SIMULATE, startIotSimulator);
router.get(API_ROUTES.IOT_SIMULATOR_ROOT, appIotSimulator);
router.get(API_ROUTES.IOT_SIMULATOR_STATUS_SIMULATE, statusIotSimulator);
router.get(API_ROUTES.IOT_SIMULATOR_HEALTH, healthIotSimulator);

// ✨ EMQX Iot Simulator
router.get(API_ROUTES.EMQX_IOT_SIMULATOR_ROOT, serveEmqxInterface);
router.post(
  API_ROUTES.EMQX_IOT_SIMULATOR_START_SIMULATE,
  emqxIoTSimulatorController.startEmqxSimulatorSimulation
);
router.post(
  API_ROUTES.EMQX_IOT_SIMULATOR_STOP_SIMULATE,
  emqxIoTSimulatorController.stopEmqxSimulatorSimulation
);
router.get(
  API_ROUTES.EMQX_IOT_SIMULATOR_STATUS_SIMULATE,
  emqxIoTSimulatorController.getEmqxSimulatorStatus
);
router.post(
  API_ROUTES.EMQX_IOT_SIMULATOR_TEST_SIMULATE,
  emqxIoTSimulatorController.publishEmqxSimulatorTestMessage
);
router.get(
  API_ROUTES.EMQX_IOT_SIMULATOR_TIMELINE_INFO,
  emqxIoTSimulatorController.getEmqxSimulatorTimelineInfo
);
router.post(
  API_ROUTES.EMQX_IOT_SIMULATOR_RESET_TIMELINE,
  emqxIoTSimulatorController.resetEmqxSimulatorTimeline
);
router.get(API_ROUTES.EMQX_DIAGNOSTICS, getEmqxDiagnostics);
router.post(
  API_ROUTES.EMQX_IOT_SIMULATOR_HEALTH,
  emqxIoTSimulatorController.healthEmqxSimulatorCheck
);
router.get(API_ROUTES.EMQX_INTERFACE, serveEmqxInterface); // '/emqx'
router.get(API_ROUTES.EMQX_HEALTH, healthEmqx); // '/emqx/health'
router.get(API_ROUTES.EMQX_STATS, getEmqxStats); // '/emqx/stats'
router.post(API_ROUTES.EMQX_TEST_PUBLISH, testPublish); // '/emqx/test/publish'
router.post(API_ROUTES.EMQX_TEST_RECONNECT, testReconnect); // '/emqx/test/reconnect'
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
router.delete(
  API_ROUTES.REDIS_COMMANDER_DELETE_KEY_PATTERN,
  deleteKeysByPattern
);
router.delete(API_ROUTES.REDIS_COMMANDER_DELETE_DATABASE, clearDatabase);
router.delete(
  API_ROUTES.REDIS_COMMANDER_DELETE_ALL_DATABASES,
  clearAllDatabases
);

// ✨ BULL BOARD ROUTES - Job queue monitoring
router.get(API_ROUTES.BULL_BOARD_HEALTH, bullHealthCheck);
router.get(API_ROUTES.BULL_BOARD_STATS, bullGetStats);
router.post(API_ROUTES.BULL_BOARD_CLEAN, bullCleanCompleted);

router.use('/bull-board', bullBoardController.getMiddleware());

export default router;
