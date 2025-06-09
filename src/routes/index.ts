import { Router } from 'express';

import processIotSimulator from '../controllers/iot-simulator.controller';
import { API_ROUTES } from './routes.const';

const router = Router();

router.post(API_ROUTES.ROOT, processIotSimulator);

export default router;
