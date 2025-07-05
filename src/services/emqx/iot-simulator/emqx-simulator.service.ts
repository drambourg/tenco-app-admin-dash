import { faker } from '@faker-js/faker';
import { Severity } from '@google-cloud/logging';
import * as turf from '@turf/turf';

import { SensorData, SensorPayload } from '../../../interfaces/data.interface';
import gcpLogger from '../../../utils/gcp/gcp-logger';
import PubSubService from '../../simulator/pubsub-topic.service'; // Import du service Pub/Sub existant
import EmqxClientService from '../client/emqx-client.service';
import {
  EnhancedSimulationConfig,
  EnhancedSimulationStatus,
} from './emqx-simulator.interface';

export class EmqxIoTSensorSimulatorService {
  // eslint-disable-next-line no-use-before-define
  private static instance: EmqxIoTSensorSimulatorService;
  private emqxService: EmqxClientService;
  private simulationTimer: NodeJS.Timeout | null = null;
  private sensorIntervals: Map<string, NodeJS.Timeout> = new Map();
  private sensorLastSendTime: Map<string, number> = new Map();
  private globalStartTime = 0;
  private currentConfig: EnhancedSimulationConfig | null = null;
  private status: EnhancedSimulationStatus = {
    elapsedSeconds: 0,
    emqxErrors: 0,
    emqxMessagesSent: 0,
    errors: 0,

    isRunning: false,

    messagesSent: 0,

    pubsubErrors: 0,
    // Nouveaux compteurs séparés
    pubsubMessagesSent: 0,
    totalSensors: 0,
  };

  private constructor() {
    this.emqxService = EmqxClientService.getInstance();
  }

  public static getInstance(): EmqxIoTSensorSimulatorService {
    if (!EmqxIoTSensorSimulatorService.instance) {
      EmqxIoTSensorSimulatorService.instance =
        new EmqxIoTSensorSimulatorService();
    }
    return EmqxIoTSensorSimulatorService.instance;
  }

  /**
   * Generates random coordinates within a bounding box around a center point
   */
  // eslint-disable-next-line class-methods-use-this
  private generateRandomCoordinates(
    centerLat: number,
    centerLng: number,
    boundingBoxKm: number
  ): [number, number] {
    // Create a bounding box around the center point
    const center = turf.point([centerLng, centerLat]);
    const bbox = turf.bbox(
      turf.buffer(center, boundingBoxKm / 2, { units: 'kilometers' })
    );

    // Generate random coordinates within the bounding box
    const randomLng = faker.number.float({ max: bbox[2], min: bbox[0] });
    const randomLat = faker.number.float({ max: bbox[3], min: bbox[1] });

    return [randomLat, randomLng];
  }

  /**
   * Generates fake sensor data for a given MAC address with synchronized timestamp
   */
  private generateSensorData(
    macAddress: string,
    centerLat: number,
    centerLng: number,
    boundingBoxKm: number,
    synchronizedTimestamp?: number
  ): SensorPayload {
    // Use synchronized timestamp or calculate next expected timestamp
    let timestamp: number;

    if (synchronizedTimestamp) {
      timestamp = synchronizedTimestamp;
    } else {
      const lastSendTime =
        this.sensorLastSendTime.get(macAddress) || this.globalStartTime;
      timestamp = lastSendTime + 1000; // Add exactly 1 second
    }

    // Update the last send time for this sensor
    this.sensorLastSendTime.set(macAddress, timestamp);

    // Generate 2 random coordinates within the bounding box
    const coord1 = this.generateRandomCoordinates(
      centerLat,
      centerLng,
      boundingBoxKm
    );

    // Generate second coordinate between 0.5 and 1.5 meters from coord1
    const distance = faker.number.float({ max: 1, min: 0.5 });
    const bearing = faker.number.float({ max: 360, min: 0 });

    // Create a point from coord1 and calculate coord2 at the specified distance and bearing
    const point1 = turf.point([coord1[1], coord1[0]]);
    const point2 = turf.destination(point1, distance / 1000, bearing, {
      units: 'kilometers',
    });
    const coord2: [number, number] = [
      point2.geometry.coordinates[1],
      point2.geometry.coordinates[0],
    ];

    // Generate realistic sensor data (2 points each)
    // Vibrations: only X and Y values (2 coordinates per point)
    const vibrationData = [
      [
        faker.number.int({ max: 300000, min: 60000 }), // X
        faker.number.float({ fractionDigits: 2, max: 60, min: 10 }), // Y
      ],
      [
        faker.number.int({ max: 300000, min: 60000 }), // X
        faker.number.float({ fractionDigits: 2, max: 60, min: 10 }), // Y
      ],
    ];

    const temperatures = [
      faker.number.int({ max: 200, min: 30 }),
      faker.number.int({ max: 200, min: 30 }),
    ];

    const accuracies = [
      faker.number.float({ fractionDigits: 2, max: 2, min: 0 }),
      faker.number.float({ fractionDigits: 2, max: 2, min: 0 }),
    ];

    const speeds = [
      faker.number.float({ fractionDigits: 1, max: 6, min: 0 }),
      faker.number.float({ fractionDigits: 1, max: 6, min: 0 }),
    ];

    return {
      acc: accuracies,
      coord: [coord1, coord2],
      mac: macAddress,
      speed: speeds,
      temp: temperatures,
      time: timestamp / 1000, // Convert to seconds
      vib: vibrationData,
    };
  }

  /**
   * Publishes sensor data to EMQX, Pub/Sub or logs for debug
   */
  private async publishSensorData(
    sensorData: SensorPayload,
    config: EnhancedSimulationConfig
  ): Promise<void> {
    try {
      if (config.debugMode) {
        // Mode debug : seulement logger
        gcpLogger({
          fileLink: __filename,
          message: '[DEBUG MODE] Sensor data would be published',
          payload: {
            coordinates: sensorData.coord,
            data: sensorData,
            mac: sensorData.mac,
            timestamp: sensorData.time,
            usePubSub: config.usePubSub,
          },
          severity: Severity.info,
        });
        console.log(
          `[DEBUG] MAC: ${sensorData.mac} - Would publish via ${
            config.usePubSub ? 'Pub/Sub' : 'EMQX'
          }:`
        );
        console.log(
          `  Coordinates: ${sensorData.coord[0][0].toFixed(
            6
          )}, ${sensorData.coord[0][1].toFixed(6)}`
        );
        console.log(
          `  Timestamp: ${new Date(sensorData.time * 1000).toISOString()}`
        );

        this.status.messagesSent += 1;
        return;
      }

      if (config.usePubSub) {
        // Mode Pub/Sub : envoyer vers GCP Pub/Sub
        const pubsubTopic = config.pubsubTopic || 'sensor-data-topic';

        // Convertir SensorPayload en SensorData pour PubSub
        const sensorDataForPubSub: SensorData = {
          // Reconvertir en milliseconds
          MACAddress: sensorData.mac,
          payload: sensorData,
          timestamp: sensorData.time * 1000,
        };

        const success = await PubSubService.publishToTopic(
          pubsubTopic,
          sensorDataForPubSub
        );

        if (success) {
          this.status.pubsubMessagesSent += 1;
          gcpLogger({
            fileLink: __filename,
            message: 'Sensor data published to Pub/Sub successfully',
            payload: {
              coordinates: sensorData.coord,
              mac: sensorData.mac,
              timestamp: sensorData.time,
              topic: pubsubTopic,
            },
            severity: Severity.debug,
          });
        } else {
          this.status.pubsubErrors += 1;
          throw new Error('Failed to publish to Pub/Sub');
        }
      } else {
        // Mode normal : publier sur EMQX
        const topic = 'data';
        const message = JSON.stringify(sensorData);

        await this.emqxService.publish(topic, message, 1);
        this.status.emqxMessagesSent += 1;

        gcpLogger({
          fileLink: __filename,
          message: 'Sensor data published to EMQX successfully',
          payload: {
            coordinates: sensorData.coord,
            mac: sensorData.mac,
            messageSize: message.length,
            timestamp: sensorData.time,
            topic,
          },
          severity: Severity.debug,
        });
      }

      this.status.messagesSent += 1;
    } catch (error) {
      if (config.usePubSub) {
        this.status.pubsubErrors += 1;
      } else {
        this.status.emqxErrors += 1;
      }
      this.status.errors += 1;

      gcpLogger({
        fileLink: __filename,
        message: `Failed to publish sensor data via ${
          config.usePubSub ? 'Pub/Sub' : 'EMQX'
        }`,
        payload: {
          debugMode: config.debugMode,
          error: error.message,
          mac: sensorData.mac,
          usePubSub: config.usePubSub,
        },
        severity: Severity.error,
      });

      if (!config.debugMode) {
        throw error;
      }
    }
  }

  /**
   * Starts the sensor simulation for a specific MAC address with synchronized timing
   */
  private startSensorSimulation(
    macAddress: string,
    config: EnhancedSimulationConfig
  ): void {
    // Calculate initial delay to synchronize with global timeline
    const currentTime = Date.now();
    const timeSinceStart = currentTime - this.globalStartTime;
    const nextSendTime =
      this.globalStartTime +
      (Math.floor(timeSinceStart / config.intervalMs) + 1) * config.intervalMs;
    const initialDelay = nextSendTime - currentTime;

    // Initialize last send time for this sensor
    this.sensorLastSendTime.set(macAddress, this.globalStartTime);

    gcpLogger({
      fileLink: __filename,
      message: `Starting sensor simulation for ${macAddress}`,
      payload: {
        initialDelay,
        intervalMs: config.intervalMs,
        macAddress,
        mode: config.usePubSub ? 'Pub/Sub' : 'EMQX',
        nextSendTime: new Date(nextSendTime).toISOString(),
      },
      severity: Severity.debug,
    });

    // Set timeout for the first synchronized send
    const initialTimeout = setTimeout(() => {
      // Send first synchronized message
      this.sendSensorMessage(macAddress, config, nextSendTime);

      // Set up regular interval
      const interval = setInterval(() => {
        this.sendSensorMessage(macAddress, config);
      }, config.intervalMs);

      this.sensorIntervals.set(macAddress, interval);
    }, Math.max(0, initialDelay));

    // Store the initial timeout so we can clear it if needed
    this.sensorIntervals.set(`${macAddress}_init`, initialTimeout);
  }

  /**
   * Sends a sensor message with proper timing
   */
  private async sendSensorMessage(
    macAddress: string,
    config: EnhancedSimulationConfig,
    forcedTimestamp?: number
  ): Promise<void> {
    try {
      const sensorData = this.generateSensorData(
        macAddress,
        config.centerLat,
        config.centerLng,
        config.boundingBoxKm,
        forcedTimestamp
      );

      await this.publishSensorData(sensorData, config);

      // Update next send time in status
      const nextSend = new Date(sensorData.time * 1000 + config.intervalMs);
      if (!this.status.nextSendTime || nextSend < this.status.nextSendTime) {
        this.status.nextSendTime = nextSend;
      }
    } catch (error) {
      gcpLogger({
        fileLink: __filename,
        message: 'Error in sensor message sending',
        payload: {
          debugMode: config.debugMode,
          error: error.message,
          mac: macAddress,
          mode: config.usePubSub ? 'Pub/Sub' : 'EMQX',
        },
        severity: Severity.error,
      });
    }
  }

  /**
   * Starts the complete simulation for all sensors with synchronized timing
   */
  public async startSimulation(
    config: EnhancedSimulationConfig
  ): Promise<void> {
    if (this.status.isRunning) {
      throw new Error('Simulation is already running');
    }

    // Validate configuration
    const validationErrors = this.validateConfig(config);
    if (validationErrors.length > 0) {
      throw new Error(
        `Configuration validation failed: ${validationErrors.join(', ')}`
      );
    }

    // Verify connection if not in debug mode
    if (!config.debugMode) {
      if (config.usePubSub) {
        // Pour Pub/Sub, pas besoin de vérification spéciale
        gcpLogger({
          fileLink: __filename,
          message: 'Using Pub/Sub mode for sensor data publishing',
          payload: {
            topic: config.pubsubTopic || 'sensor-data-topic',
          },
          severity: Severity.info,
        });
      } else {
        // Vérifier EMQX
        const emqxStatus = this.emqxService.getStatus();
        if (!emqxStatus.connected) {
          try {
            await this.emqxService.connect();
          } catch (connectError) {
            throw new Error(
              'EMQX is not connected and failed to reconnect. Enable debug mode, use Pub/Sub mode, or fix EMQX connection.'
            );
          }
        }

        // Informer EMQX qu'une simulation commence
        this.emqxService.setSimulationRunning(true);
      }
    }

    // Store current configuration
    this.currentConfig = config;

    // Set global start time for synchronization
    const now = Date.now();
    if (this.globalStartTime === 0) {
      // First start - align to the next second boundary
      this.globalStartTime = Math.ceil(now / 1000) * 1000;
    } else {
      // Restart - calculate where we should be in the timeline
      const timeSinceOriginalStart = now - this.globalStartTime;
      const cyclesSinceStart = Math.floor(
        timeSinceOriginalStart / config.intervalMs
      );
      this.globalStartTime += cyclesSinceStart * config.intervalMs;
    }

    // Initialize simulation status
    this.status = {
      elapsedSeconds: 0,
      emqxErrors: this.status.emqxErrors,
      emqxMessagesSent: this.status.emqxMessagesSent,
      endTime: new Date(Date.now() + config.durationMinutes * 60 * 1000),

      errors: this.status.errors,
      // Keep previous count
      isRunning: true,

      messagesSent: this.status.messagesSent,

      // Keep previous count
      nextSendTime: new Date(this.globalStartTime + config.intervalMs),

      pubsubErrors: this.status.pubsubErrors,
      // Reset specific counters
      pubsubMessagesSent: this.status.pubsubMessagesSent,
      startTime: new Date(),
      totalSensors: config.macAddresses.length,
    };

    gcpLogger({
      fileLink: __filename,
      message: 'Starting IoT sensor simulation with synchronized timing',
      payload: {
        boundingBoxKm: config.boundingBoxKm,
        centerCoordinates: [config.centerLat, config.centerLng],
        debugMode: config.debugMode,
        durationMinutes: config.durationMinutes,
        globalStartTime: new Date(this.globalStartTime).toISOString(),
        intervalMs: config.intervalMs,
        mode: config.usePubSub ? 'Pub/Sub' : 'EMQX',
        pubsubTopic: config.pubsubTopic || 'sensor-data-topic',
        synchronizedStart: true,
        totalSensors: config.macAddresses.length,
      },
      severity: Severity.info,
    });

    // Start simulation for each sensor with synchronized timing
    for (const macAddress of config.macAddresses) {
      this.startSensorSimulation(macAddress, config);
    }

    // Set up timer to track elapsed time
    const startTime = Date.now();
    const elapsedTimer = setInterval(() => {
      this.status.elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    }, 1000);

    // Set up timer to stop simulation after duration
    this.simulationTimer = setTimeout(async () => {
      await this.stopSimulation();
      clearInterval(elapsedTimer);

      gcpLogger({
        fileLink: __filename,
        message: 'IoT sensor simulation completed',
        payload: {
          debugMode: config.debugMode,
          duration: config.durationMinutes,
          emqxMessages: this.status.emqxMessagesSent,
          mode: config.usePubSub ? 'Pub/Sub' : 'EMQX',
          pubsubMessages: this.status.pubsubMessagesSent,
          sensorsCount: config.macAddresses.length,
          timelineContinuity: 'maintained',
          totalErrors: this.status.errors,
          totalMessages: this.status.messagesSent,
        },
        severity: Severity.info,
      });
    }, config.durationMinutes * 60 * 1000);
  }

  /**
   * Stops the simulation while preserving timeline continuity
   */
  public async stopSimulation(): Promise<void> {
    if (!this.status.isRunning) {
      return;
    }

    // Clear all sensor intervals (including initial timeouts)
    for (const [key, interval] of this.sensorIntervals) {
      if (key.endsWith('_init')) {
        clearTimeout(interval as NodeJS.Timeout);
      } else {
        clearInterval(interval as NodeJS.Timeout);
      }
    }
    this.sensorIntervals.clear();

    // Clear main simulation timer
    if (this.simulationTimer) {
      clearTimeout(this.simulationTimer);
      this.simulationTimer = null;
    }

    this.status.isRunning = false;
    this.status.nextSendTime = undefined;

    // Informer EMQX que la simulation est terminée (seulement si utilisé)
    if (
      this.currentConfig &&
      !this.currentConfig.debugMode &&
      !this.currentConfig.usePubSub
    ) {
      this.emqxService.setSimulationRunning(false);
    }

    gcpLogger({
      fileLink: __filename,
      message: 'IoT sensor simulation stopped with timeline preservation',
      payload: {
        elapsedSeconds: this.status.elapsedSeconds,
        emqxMessages: this.status.emqxMessagesSent,
        errors: this.status.errors,
        globalTimelinePreserved: true,
        messagesSent: this.status.messagesSent,
        mode: this.currentConfig?.usePubSub ? 'Pub/Sub' : 'EMQX',
        nextRestartWillBeSynchronized: true,
        pubsubMessages: this.status.pubsubMessagesSent,
      },
      severity: Severity.info,
    });
  }

  /**
   * Gets the current simulation status
   */
  public getStatus(): EnhancedSimulationStatus {
    return { ...this.status };
  }

  /**
   * Gets the current configuration
   */
  public getCurrentConfig(): EnhancedSimulationConfig | null {
    return this.currentConfig ? { ...this.currentConfig } : null;
  }

  /**
   * Publishes a single test message for a sensor
   */
  public async publishTestMessage(
    macAddress: string,
    centerLat = 48.8566,
    centerLng = 2.3522,
    boundingBoxKm = 0.2,
    usePubSub = false,
    pubsubTopic = 'sensor-data-topic'
  ): Promise<SensorPayload> {
    // Use current time for test messages
    const sensorData = this.generateSensorData(
      macAddress,
      centerLat,
      centerLng,
      boundingBoxKm,
      Date.now()
    );

    const testConfig: EnhancedSimulationConfig = {
      boundingBoxKm,
      centerLat,
      centerLng,
      debugMode: false,
      durationMinutes: 1,
      intervalMs: 1000,
      macAddresses: [macAddress],
      pubsubTopic,
      usePubSub,
    };

    await this.publishSensorData(sensorData, testConfig);

    return sensorData;
  }

  /**
   * Resets the global timeline (useful for testing or manual reset)
   */
  public resetTimeline(): void {
    if (this.status.isRunning) {
      throw new Error('Cannot reset timeline while simulation is running');
    }

    this.globalStartTime = 0;
    this.sensorLastSendTime.clear();
    this.status.messagesSent = 0;
    this.status.errors = 0;
    this.status.pubsubMessagesSent = 0;
    this.status.emqxMessagesSent = 0;
    this.status.pubsubErrors = 0;
    this.status.emqxErrors = 0;
    this.currentConfig = null;

    gcpLogger({
      fileLink: __filename,
      message: 'Timeline reset - next simulation will start fresh',
      severity: Severity.info,
    });
  }

  /**
   * Gets the current timeline information
   */
  public getTimelineInfo(): {
    globalStartTime: number;
    isTimelineActive: boolean;
    nextExpectedSends: { [mac: string]: number };
  } {
    const nextExpectedSends: { [mac: string]: number } = {};

    for (const [mac, lastSend] of this.sensorLastSendTime) {
      nextExpectedSends[mac] = lastSend + 1000;
    }

    return {
      globalStartTime: this.globalStartTime,
      isTimelineActive: this.globalStartTime > 0,
      nextExpectedSends,
    };
  }

  /**
   * Validates simulation configuration
   */
  // eslint-disable-next-line class-methods-use-this
  public validateConfig(config: EnhancedSimulationConfig): string[] {
    const errors: string[] = [];

    if (!config.macAddresses || config.macAddresses.length === 0) {
      errors.push('MAC addresses array is required and cannot be empty');
    }

    if (
      config.centerLat === undefined ||
      config.centerLat === null ||
      config.centerLat < -90 ||
      config.centerLat > 90
    ) {
      errors.push('Center latitude must be between -90 and 90');
    }

    if (
      config.centerLng === undefined ||
      config.centerLng === null ||
      config.centerLng < -180 ||
      config.centerLng > 180
    ) {
      errors.push('Center longitude must be between -180 and 180');
    }

    if (
      !config.boundingBoxKm ||
      config.boundingBoxKm <= 0 ||
      config.boundingBoxKm > 10
    ) {
      errors.push('Bounding box size must be between 0.1 and 10 km');
    }

    if (!config.intervalMs || config.intervalMs < 100) {
      errors.push('Interval must be at least 100ms');
    }

    if (
      !config.durationMinutes ||
      config.durationMinutes <= 0 ||
      config.durationMinutes > 60
    ) {
      errors.push('Duration must be between 1 and 60 minutes');
    }

    // Check for duplicate MAC addresses
    const uniqueMacs = new Set(config.macAddresses);
    if (uniqueMacs.size !== config.macAddresses.length) {
      errors.push('Duplicate MAC addresses found');
    }

    return errors;
  }
}

export default EmqxIoTSensorSimulatorService;
