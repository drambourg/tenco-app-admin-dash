import dotenv from 'dotenv';

const environment = process.env.NODE_ENV || 'development';
dotenv.config({
  path: [`.env`, `.env.${environment}`],
});

const PORT = process.env.PORT || 4001;
const NODE_ENV = process.env.NODE_ENV || 'development';

const { DEBUG, GCP_PROJECT_ID } = process.env;

const GCP_LOGGER_NAME = process.env.GCP_LOGGER_NAME || 'iot-simulator-logger';

export { DEBUG, PORT, NODE_ENV, GCP_PROJECT_ID, GCP_LOGGER_NAME };
