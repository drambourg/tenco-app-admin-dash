import { Router } from 'express';

import {
  appIotSimulator,
  healthIotSimulator,
  startIotSimulator,
  statusIotSimulator,
  stopIotSimulator,
  testIotSimulator,
} from '../controllers/iot-simulator.controller';
import { API_ROUTES } from './routes.const';

const router = Router();

router.post(API_ROUTES.STOP_SIMULATE, stopIotSimulator);
router.post(API_ROUTES.TEST_SIMULATE, testIotSimulator);
router.post(API_ROUTES.START_SIMULATE, startIotSimulator);
router.get(API_ROUTES.ROOT, appIotSimulator);
router.get(API_ROUTES.STATUS_SIMULATE, statusIotSimulator);
router.get(API_ROUTES.HEALTH, healthIotSimulator);

export default router;
