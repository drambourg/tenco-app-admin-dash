import { Request, Response } from 'express';

import { SERVICE_SENSOR_DATA_DISPATCHER_URL } from '../config/config';
import { API_RESPONSES } from '../config/config.const';
import IoTSimulator from '../services/simulator/iot-simulator-processing.service';
import { AppError, GENERIC_ERRORS, HTTP_CODES } from '../utils/error';
import parseRequestBody from '../utils/parse-body';

// Global simulator instance
let simulator: IoTSimulator | null = null;
/**
 * Processes incoming sensor data
 */
async function testIotSimulator(req: Request, res: Response): Promise<void> {
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

    // Validate sen
    // Return success response
    res.status(HTTP_CODES.OK).send({
      data: { safeBody },
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

/**
 * Processes incoming sensor data
 */
async function startIotSimulator(req: Request, res: Response) {
  try {
    if (simulator?.getStatus().isRunning) {
      return res.status(400).json({
        error: 'Simulation already running',
        status: simulator.getStatus(),
      });
    }

    // Use custom config or default
    const { config } = req.body;

    // Validate required fields
    if (!config.macAddresses || config.macAddresses.length === 0) {
      return res.status(400).json({
        error: 'macAddresses array is required and must not be empty',
      });
    }

    if (!config.durationMinutes || config.durationMinutes <= 0) {
      return res.status(400).json({
        error: 'durationMinutes is required and must be greater than 0',
      });
    }

    if (SERVICE_SENSOR_DATA_DISPATCHER_URL) {
      if (!config.endpoints) {
        config.endpoints = [];
      }
      config.endpoints.push(SERVICE_SENSOR_DATA_DISPATCHER_URL);
    }

    simulator = new IoTSimulator(config);
    simulator.start();

    res.status(200).json({
      message: 'Simulation started',
      status: simulator.getStatus(),
    });
  } catch (error) {
    res.status(500).json({
      details: error.message,
      error: 'Error starting simulation',
    });
  }
}

async function stopIotSimulator(req: Request, res: Response) {
  try {
    if (!simulator || !simulator.getStatus().isRunning) {
      return res.status(400).json({
        error: 'No simulation running',
      });
    }

    simulator.stop();

    res.status(200).json({
      message: 'Simulation stopped',
      status: simulator.getStatus(),
    });
  } catch (error) {
    res.status(500).json({
      details: error.message,
      error: 'Error stopping simulation',
    });
  }
}

async function statusIotSimulator(req: Request, res: Response) {
  if (!simulator) {
    return res.status(200).json({
      isRunning: false,
      message: 'No simulation initialized',
    });
  }

  res.status(200).json({
    message: 'Simulation status',
    ...simulator.getStatus(),
  });
}

async function healthIotSimulator(req: Request, res: Response) {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}

async function appIotSimulator(req: Request, res: Response) {
  res.json({
    body_sample: {
      config: {
        boundingBox: {
          east: 2.4699,
          north: 48.9021,
          south: 48.8155,
          west: 2.2241,
        },
        dataRanges: {
          accuracy: { max: 8, min: 2 },
          amplitude: { max: 120000, min: 50000 },
          temperature: { max: 35, min: 15 },
        },
        durationMinutes: 30,
        endpoints: [
          'https://your-endpoint-1.com/api/data',
          'https://your-endpoint-2.com/api/data',
        ],
        macAddresses: ['AA:BB:CC:DD:EE:01', 'AA:BB:CC:DD:EE:02'],
        sendIntervalMs: 1000,
      },
    },
    endpoints: {
      'GET /health': 'Health check',
      'GET /status': 'Current simulation status',
      'POST /start': 'Start simulation with custom config',
      'POST /stop': 'Stop running simulation',
      'POST /test': 'Test endpoint for receiving data',
    },
    message: 'IoT Simulator - Moving Sensors',
  });
}

export {
  testIotSimulator,
  startIotSimulator,
  stopIotSimulator,
  statusIotSimulator,
  healthIotSimulator,
  appIotSimulator,
};
