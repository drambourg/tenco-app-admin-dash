import { Request } from 'express';

/**
 * Function to handle different formats of request body.
 * It processes Base64-encoded messages and direct JSON payloads.
 */
function parseRequestBody(req: Request): any {
  try {
    if (req.body.message?.data) {
      // Decode Base64-encoded message
      const decodedBuffer = Buffer.from(req.body.message.data, 'base64');
      const decodedMessage = decodedBuffer.toString('utf-8');
      return JSON.parse(decodedMessage);
    }

    return req.body;
  } catch (error) {
    throw new Error('Invalid request body format');
  }
}

export default parseRequestBody;
