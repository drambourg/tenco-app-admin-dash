import { Severity } from '@google-cloud/logging';
import { Request, Response } from 'express';

import { EnhancedSimulationConfig } from '../services/emqx/iot-simulator/emqx-simulator.interface';
import EmqxIoTSensorSimulatorService from '../services/emqx/iot-simulator/emqx-simulator.service';
import gcpLogger from '../utils/gcp/gcp-logger';

export class EmqxIoTSimulatorController {
  private simulatorService: EmqxIoTSensorSimulatorService;

  constructor() {
    this.simulatorService = EmqxIoTSensorSimulatorService.getInstance();
  }

  /**
   * Start simulation with enhanced geographic configuration and Pub/Sub option
   */
  public startEmqxSimulatorSimulation = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const {
        boundingBoxKm,
        centerLat,
        centerLng,
        debugMode = false,
        durationMinutes = 1,
        intervalMs = 1000,
        macAddresses,
        pubsubTopic = 'sensor-data-topic', // Nouvelle option
        usePubSub = false, // Topic par défaut
      } = req.body;

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

      const config: EnhancedSimulationConfig = {
        boundingBoxKm: parseFloat(boundingBoxKm),
        centerLat: parseFloat(centerLat),
        centerLng: parseFloat(centerLng),
        debugMode: Boolean(debugMode),
        durationMinutes: parseInt(durationMinutes, 10),
        intervalMs: parseInt(intervalMs, 10),
        macAddresses: macAddresses.map((mac: string) => mac.trim()),
        pubsubTopic: String(pubsubTopic),
        usePubSub: Boolean(usePubSub),
      };

      // Validation de la configuration
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
        message: 'EMQX IoT simulation started with geographic configuration',
        payload: {
          config,
          mode: config.usePubSub ? 'Pub/Sub' : 'EMQX',
          status,
        },
        severity: Severity.info,
      });

      res.json({
        config,
        message: `Simulation started successfully in ${
          config.usePubSub ? 'Pub/Sub' : 'EMQX'
        } mode`,
        status,
        success: true,
      });
    } catch (error) {
      gcpLogger({
        fileLink: __filename,
        message: `Failed to start simulation: ${error.message}`,
        payload: {
          body: req.body,
          error: error.message,
        },
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
        message: 'Simulation stopped successfully',
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
   * Get status with current configuration
   */
  public getEmqxSimulatorStatus = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const status = this.simulatorService.getStatus();
      const timeline = this.simulatorService.getTimelineInfo();
      const currentConfig = this.simulatorService.getCurrentConfig();

      res.json({
        config: currentConfig,
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
   * Test single message with geographic parameters and mode selection
   */
  public publishEmqxSimulatorTestMessage = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const {
        boundingBoxKm = 0.2,
        centerLat = 48.8566,
        centerLng = 2.3522,
        macAddress = '00:11:22:33:44:TEST',
        pubsubTopic = 'sensor-data-topic',
        usePubSub = false,
      } = req.body;

      const sensorData = await this.simulatorService.publishTestMessage(
        macAddress,
        parseFloat(centerLat),
        parseFloat(centerLng),
        parseFloat(boundingBoxKm),
        Boolean(usePubSub),
        String(pubsubTopic)
      );

      res.json({
        data: sensorData,
        message: `Test message published successfully via ${
          usePubSub ? 'Pub/Sub' : 'EMQX'
        }`,
        mode: usePubSub ? 'Pub/Sub' : 'EMQX',
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
        message: 'Timeline reset successfully',
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
   * Health check with enhanced information including Pub/Sub stats
   */
  public healthEmqxSimulatorCheck = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const status = this.simulatorService.getStatus();
      const timeline = this.simulatorService.getTimelineInfo();
      const currentConfig = this.simulatorService.getCurrentConfig();

      res.json({
        config: currentConfig
          ? {
              boundingBoxKm: currentConfig.boundingBoxKm,
              centerLat: currentConfig.centerLat,
              centerLng: currentConfig.centerLng,
              debugMode: currentConfig.debugMode,
              mode: currentConfig.usePubSub ? 'Pub/Sub' : 'EMQX',
              pubsubTopic: currentConfig.pubsubTopic,
              sensorsCount: currentConfig.macAddresses.length,
            }
          : null,
        errors: status.errors,
        messagesSent: status.messagesSent,
        running: status.isRunning,
        sensors: status.totalSensors,
        service: 'EMQX IoT Simulator',
        // Statistiques détaillées par mode
        stats: {
          emqx: {
            errors: status.emqxErrors || 0,
            messages: status.emqxMessagesSent || 0,
          },
          pubsub: {
            errors: status.pubsubErrors || 0,
            messages: status.pubsubMessagesSent || 0,
          },
          total: {
            errors: status.errors,
            messages: status.messagesSent,
          },
        },

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
