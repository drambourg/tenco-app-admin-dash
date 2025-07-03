import { Severity } from '@google-cloud/logging';
import { Request, Response } from 'express';

import { SimulationConfig } from '../services/emqx/iot-simulator/emqx-simulator.interface';
import EmqxIoTSensorSimulatorService from '../services/emqx/iot-simulator/emqx-simulator.service';
import gcpLogger from '../utils/gcp/gcp-logger';

export class EmqxIoTSimulatorController {
  private simulatorService: EmqxIoTSensorSimulatorService;

  constructor() {
    this.simulatorService = EmqxIoTSensorSimulatorService.getInstance();
  }

  /**
   * Start simulation
   */
  public startEmqxSimulatorSimulation = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { boundingBoxKm, centerLat, centerLng, macAddresses } = req.body;

      // Validation des champs requis
      if (
        !macAddresses ||
        !Array.isArray(macAddresses) ||
        macAddresses.length === 0
      ) {
        res.status(400).json({
          error: 'macAddresses is required and must be a non-empty array',
          success: false,
        });
        return;
      }

      if (centerLat === undefined || centerLat === null) {
        res.status(400).json({
          error: 'centerLat is required',
          success: false,
        });
        return;
      }

      if (centerLng === undefined || centerLng === null) {
        res.status(400).json({
          error: 'centerLng is required',
          success: false,
        });
        return;
      }

      if (boundingBoxKm === undefined || boundingBoxKm === null) {
        res.status(400).json({
          error: 'boundingBoxKm is required',
          success: false,
        });
        return;
      }

      const config: SimulationConfig = {
        boundingBoxKm,
        centerLat,
        centerLng,
        durationMinutes: req.body.durationMinutes || 1,
        intervalMs: req.body.intervalMs || 1000,
        macAddresses,
      };

      const validationErrors = this.simulatorService.validateConfig(config);
      if (validationErrors.length > 0) {
        res.status(400).json({
          details: validationErrors,
          error: 'Configuration validation failed',
          success: false,
        });
        return;
      }

      await this.simulatorService.startSimulation(config);
      const status = this.simulatorService.getStatus();

      gcpLogger({
        fileLink: __filename,
        message: 'EMQX IoT simulation started',
        severity: Severity.info,
      });

      res.json({
        message: 'Simulation started',
        status,
        success: true,
      });
    } catch (error) {
      gcpLogger({
        fileLink: __filename,
        message: `Failed to start simulation: ${error.message}`,
        severity: Severity.error,
      });

      res.status(500).json({
        error: error.message,
        success: false,
      });
    }
  };

  /**
   * Stop simulation
   */
  public stopEmqxSimulatorSimulation = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      await this.simulatorService.stopSimulation();
      const status = this.simulatorService.getStatus();

      res.json({
        message: 'Simulation stopped',
        status,
        success: true,
      });
    } catch (error) {
      res.status(500).json({
        error: error.message,
        success: false,
      });
    }
  };

  /**
   * Get status
   */
  public getEmqxSimulatorStatus = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const status = this.simulatorService.getStatus();
      const timeline = this.simulatorService.getTimelineInfo();

      res.json({
        status,
        success: true,
        timeline,
      });
    } catch (error) {
      res.status(500).json({
        error: error.message,
        success: false,
      });
    }
  };

  /**
   * Test single message
   */
  public publishEmqxSimulatorTestMessage = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const macAddress = req.body.macAddress || '00:11:22:33:44:55';
      const centerLat = req.body.centerLat || 48.8566;
      const centerLng = req.body.centerLng || 2.3522;
      const boundingBoxKm = req.body.boundingBoxKm || 0.2;

      const sensorData = await this.simulatorService.publishTestMessage(
        macAddress,
        centerLat,
        centerLng,
        boundingBoxKm
      );

      res.json({
        data: sensorData,
        message: 'Test message published',
        success: true,
      });
    } catch (error) {
      res.status(500).json({
        error: error.message,
        success: false,
      });
    }
  };

  /**
   * Get timeline info
   */
  public getEmqxSimulatorTimelineInfo = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const timeline = this.simulatorService.getTimelineInfo();
      const status = this.simulatorService.getStatus();

      res.json({
        isRunning: status.isRunning,
        success: true,
        timeline,
      });
    } catch (error) {
      res.status(500).json({
        error: error.message,
        success: false,
      });
    }
  };

  /**
   * Reset timeline
   */
  public resetEmqxSimulatorTimeline = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      this.simulatorService.resetTimeline();

      res.json({
        message: 'Timeline reset',
        success: true,
      });
    } catch (error) {
      res.status(500).json({
        error: error.message,
        success: false,
      });
    }
  };

  /**
   * Health check
   */
  public healthEmqxSimulatorCheck = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const status = this.simulatorService.getStatus();
      const timeline = this.simulatorService.getTimelineInfo();

      res.json({
        errors: status.errors,
        messagesSent: status.messagesSent,
        running: status.isRunning,
        sensors: status.totalSensors,
        service: 'EMQX IoT Simulator',
        status: 'healthy',
        success: true,
        timelineActive: timeline.isTimelineActive,
      });
    } catch (error) {
      res.status(500).json({
        error: error.message,
        service: 'EMQX IoT Simulator',
        status: 'unhealthy',
        success: false,
      });
    }
  };
}

export default EmqxIoTSimulatorController;
