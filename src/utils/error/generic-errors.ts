import { AppErrorArgs } from './appError';
import HTTP_CODES from './http-codes';

enum GenericErrorKeyEnum {
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATA_REQUEST_ERROR = 'DATA_REQUEST_ERROR',
  DATA_REQUEST_INVALID_FORMAT_ERROR = 'DATA_REQUEST_INVALID_FORMAT_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',
  APP_ENV_ERROR = 'APP_ENV_ERROR',
  METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED',
}

const GENERIC_ERRORS: Record<GenericErrorKeyEnum, AppErrorArgs> = {
  APP_ENV_ERROR: {
    isOperational: true,
    message: 'Application environment errors. Check environment file',
    name: 'AppEnvError',
    statusCode: HTTP_CODES.INTERNAL_SERVER_ERROR,
  },
  BAD_REQUEST: {
    isOperational: false,
    message: 'Invalid JSON payload',
    name: 'BadRequestError',
    statusCode: HTTP_CODES.INTERNAL_SERVER_ERROR,
  },
  DATA_REQUEST_ERROR: {
    isOperational: false,
    message: 'Request parameters are invalid',
    name: 'DataRequestError',
    statusCode: HTTP_CODES.INTERNAL_SERVER_ERROR,
  },
  DATA_REQUEST_INVALID_FORMAT_ERROR: {
    isOperational: false,
    message: 'Request invalid format',
    name: 'DataRequestInvalidFormatError',
    statusCode: HTTP_CODES.INTERNAL_SERVER_ERROR,
  },
  INTERNAL_SERVER_ERROR: {
    isOperational: false,
    message: 'Internal Server Error',
    name: 'InternalServerError',
    statusCode: HTTP_CODES.INTERNAL_SERVER_ERROR,
  },
  METHOD_NOT_ALLOWED: {
    isOperational: false,
    message: 'Method Not Allowed. Only POST requests are accepted.',
    name: 'MethodNotAllowed',
    statusCode: HTTP_CODES.METHOD_NOT_ALLOWED,
  },
};

export default GENERIC_ERRORS;
