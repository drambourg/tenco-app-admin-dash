import dotenv from 'dotenv';

const environment = process.env.NODE_ENV || 'development';
dotenv.config({
  path: [`.env`, `.env.${environment}`],
});

const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'development';

const {
  DEBUG,
  GCP_PROJECT_ID,
  REDIS_HOST,
  SERVICE_SENSOR_DATA_DISPATCHER_URL,
} = process.env;

const GCP_LOGGER_NAME = process.env.GCP_LOGGER_NAME || 'iot-simulator-logger';

const redisPortRaw = process.env.REDIS_PORT;
const REDIS_PORT = parseInt(redisPortRaw, 10) || 6379;

export {
  DEBUG,
  PORT,
  NODE_ENV,
  GCP_PROJECT_ID,
  GCP_LOGGER_NAME,
  SERVICE_SENSOR_DATA_DISPATCHER_URL,
  REDIS_PORT,
  REDIS_HOST,
};
