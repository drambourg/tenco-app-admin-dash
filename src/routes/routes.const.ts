import { PORT } from '../config/config';

export const API_ROUTES = {
  ROOT: '/',
  TASKS: '/tasks/:taskName',
};

export const SERVER = {
  BODY_LIMIT: '10mb',
  DEFAULT_PORT: 8080,
  DEV_PORT: Number(PORT),
};

export const FUNCTION_NAMES = {
  IOT_SIMULATOR: 'iot-simulator',
};
