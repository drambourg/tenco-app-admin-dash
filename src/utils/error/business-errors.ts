import { AppErrorArgs } from './appError';
import HTTP_CODES from './http-codes';

enum BusinessErrorKeyEnum {
  DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND',
}

const BUSINESS_ERRORS: Record<BusinessErrorKeyEnum, AppErrorArgs> = {
  DEVICE_NOT_FOUND: {
    isOperational: true,
    message: 'Device with the provided MAC address was not found',
    name: 'DeviceNotFoundError',
    statusCode: HTTP_CODES.NOT_FOUND,
  },
};

export default BUSINESS_ERRORS;
