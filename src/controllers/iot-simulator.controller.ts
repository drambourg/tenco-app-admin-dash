import { Request, Response } from 'express';

import { API_RESPONSES } from '../config/config.const';
import { AppError, GENERIC_ERRORS, HTTP_CODES } from '../utils/error';
import parseRequestBody from '../utils/parse-body';

/**
 * Processes incoming sensor data
 */
export default async function processIotSimulator(
  req: Request,
  res: Response
): Promise<void> {
  /*   const inputData = req.body; */
  let safeData;

  try {
    // Ensure we're handling a POST request
    if (req.method !== 'POST') {
      throw new AppError({
        ...GENERIC_ERRORS.METHOD_NOT_ALLOWED,
        message: GENERIC_ERRORS.METHOD_NOT_ALLOWED.message,
      });
    }

    // Parse and sanitize the request body
    const safeBody = parseRequestBody(req);

    console.log(safeBody);
    // Validate sen
    // Return success response
    res.status(HTTP_CODES.OK).send({
      data: { safeData },
      ...API_RESPONSES.SIMULATE_SUCCESS,
    });
  } catch (error) {
    // Determine appropriate status code based on error type
    const statusCode =
      error instanceof AppError
        ? error.statusCode
        : HTTP_CODES.INTERNAL_SERVER_ERROR;

    // Return error response
    res.status(statusCode).send({
      error:
        error.message ||
        JSON.stringify(error) ||
        GENERIC_ERRORS.INTERNAL_SERVER_ERROR.message,
    });
  }
}
