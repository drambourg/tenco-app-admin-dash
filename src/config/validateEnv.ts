import { cleanEnv, port, str } from 'envalid';

import { AppError, GENERIC_ERRORS } from '../utils/error';

const validateEnv = () => {
  try {
    cleanEnv(process.env, {
      GCP_LOGGER_NAME: str(),
      GCP_PROJECT_ID: str(),
      NODE_ENV: str({ default: undefined }),
      PORT: port(),
    });
  } catch (error) {
    throw new AppError({
      ...GENERIC_ERRORS.APP_ENV_ERROR,
      message: `${GENERIC_ERRORS.APP_ENV_ERROR.message} ${error}`,
    });
  }
};

export default validateEnv;
