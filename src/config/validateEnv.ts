import { cleanEnv, port, str } from 'envalid';

import { AppError, GENERIC_ERRORS } from '../utils/error';

const validateEnv = () => {
  try {
    cleanEnv(process.env, {
      ADMIN_PASSWORD: str(),
      ADMIN_USERNAME: str(),

      EMQX_BROKER: str(),
      EMQX_CONNECT_TIMEOUT: port({ default: 10000 }),
      EMQX_KEEP_ALIVE: port({ default: 180 }),
      EMQX_PASSWORD: str(),
      EMQX_PORT: port({ default: 1883 }),
      EMQX_QOS: port({ default: 1 }),
      EMQX_TOPIC: str(),
      EMQX_USERNAME: str(),
      GCP_LOGGER_NAME: str(),
      GCP_PROJECT_ID: str(),
      NODE_ENV: str({ default: undefined }),
      PORT: port(),
      REDIS_HOST: str(),
      REDIS_PORT: port({ default: 6379 }),
    });
  } catch (error) {
    throw new AppError({
      ...GENERIC_ERRORS.APP_ENV_ERROR,
      message: `${GENERIC_ERRORS.APP_ENV_ERROR.message} ${error}`,
    });
  }
};

export default validateEnv;
