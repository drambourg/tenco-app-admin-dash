import { faker } from '@faker-js/faker';
import { Severity } from '@google-cloud/logging';
import * as turf from '@turf/turf';

import { SensorPayload } from '../../../interfaces/data.interface';
import gcpLogger from '../../../utils/gcp/gcp-logger';
import EmqxClientService from '../client/emqx-client.service';
import { SimulationConfig, SimulationStatus } from './emqx-simulator.interface';

export class EmqxIoTSensorSimulatorService {
  // eslint-disable-next-line no-use-before-define
  private static instance: EmqxIoTSensorSimulatorService;
  private emqxService: EmqxClientService;
  private simulationTimer: NodeJS.Timeout | null = null;
  private sensorIntervals: Map<string, NodeJS.Timeout> = new Map();
  private sensorLastSendTime: Map<string, number> = new Map();
  private globalStartTime = 0;
  private status: SimulationStatus = {
    elapsedSeconds: 0,
    errors: 0,
    isRunning: false,
    messagesSent: 0,
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
    const coord2 = this.generateRandomCoordinates(
      centerLat,
      centerLng,
      boundingBoxKm
    );

    // Generate realistic sensor data (2 points each)
    // Vibrations: only X and Y values (2 coordinates per point)
    const vibrationData = [
      [
        faker.number.float({ max: 100, min: 0, precision: 0.01 }), // X
        faker.number.float({ max: 100, min: 0, precision: 0.01 }), // Y
      ],
      [
        faker.number.float({ max: 100, min: 0, precision: 0.01 }), // X
        faker.number.float({ max: 100, min: 0, precision: 0.01 }), // Y
      ],
    ];

    const temperatures = [
      faker.number.float({ max: 60, min: -20, precision: 0.1 }),
      faker.number.float({ max: 60, min: -20, precision: 0.1 }),
    ];

    const accelerations = [
      faker.number.float({ max: 10, min: 0, precision: 0.01 }),
      faker.number.float({ max: 10, min: 0, precision: 0.01 }),
    ];

    const speeds = [
      faker.number.float({ max: 120, min: 0, precision: 0.1 }),
      faker.number.float({ max: 120, min: 0, precision: 0.1 }),
    ];

    return {
      acc: accelerations,
      coord: [coord1, coord2],
      mac: macAddress,
      speed: speeds,
      temp: temperatures,
      time: timestamp,
      vib: vibrationData,
    };
  }

  /**
   * Publishes sensor data to EMQX
   */
  private async publishSensorData(sensorData: SensorPayload): Promise<void> {
    try {
      const topic = 'data'; // Fixed topic name
      const message = JSON.stringify(sensorData);

      await this.emqxService.publish(topic, message, 1);

      this.status.messagesSent += 1;

      gcpLogger({
        fileLink: __filename,
        message: 'Sensor data published successfully',
        payload: {
          mac: sensorData.mac,
          messageSize: message.length,
          timestamp: sensorData.time,
          topic,
        },
        severity: Severity.debug,
      });
    } catch (error) {
      this.status.errors += 1;

      gcpLogger({
        fileLink: __filename,
        message: 'Failed to publish sensor data',
        payload: {
          error: error.message,
          mac: sensorData.mac,
        },
        severity: Severity.error,
      });

      throw error;
    }
  }

  /**
   * Starts the sensor simulation for a specific MAC address with synchronized timing
   */
  private startSensorSimulation(
    macAddress: string,
    config: SimulationConfig
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
    config: SimulationConfig,
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

      await this.publishSensorData(sensorData);

      // Update next send time in status
      const nextSend = new Date(sensorData.time + config.intervalMs);
      if (!this.status.nextSendTime || nextSend < this.status.nextSendTime) {
        this.status.nextSendTime = nextSend;
      }
    } catch (error) {
      gcpLogger({
        fileLink: __filename,
        message: 'Error in sensor message sending',
        payload: {
          error: error.message,
          mac: macAddress,
        },
        severity: Severity.error,
      });
    }
  }

  /**
   * Starts the complete simulation for all sensors with synchronized timing
   */
  public async startSimulation(config: SimulationConfig): Promise<void> {
    if (this.status.isRunning) {
      throw new Error('Simulation is already running');
    }

    // Verify EMQX connection
    const emqxStatus = this.emqxService.getStatus();
    if (!emqxStatus.connected) {
      throw new Error('EMQX is not connected');
    }

    // Set global start time for synchronization
    // If this is a restart, maintain timeline continuity
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
      // Keep previous count
      elapsedSeconds: 0,

      endTime: new Date(Date.now() + config.durationMinutes * 60 * 1000),

      // Keep previous count
      errors: this.status.errors,

      isRunning: true,

      messagesSent: this.status.messagesSent,

      nextSendTime: new Date(this.globalStartTime + config.intervalMs),

      startTime: new Date(),
      totalSensors: config.macAddresses.length,
    };

    gcpLogger({
      fileLink: __filename,
      message: 'Starting IoT sensor simulation with synchronized timing',
      payload: {
        boundingBoxKm: config.boundingBoxKm,
        centerCoordinates: [config.centerLat, config.centerLng],
        durationMinutes: config.durationMinutes,
        globalStartTime: new Date(this.globalStartTime).toISOString(),
        intervalMs: config.intervalMs,
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
          duration: config.durationMinutes,
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

    gcpLogger({
      fileLink: __filename,
      message: 'IoT sensor simulation stopped with timeline preservation',
      payload: {
        elapsedSeconds: this.status.elapsedSeconds,
        errors: this.status.errors,
        globalTimelinePreserved: true,
        messagesSent: this.status.messagesSent,
        nextRestartWillBeSynchronized: true,
      },
      severity: Severity.info,
    });
  }

  /**
   * Gets the current simulation status
   */
  public getStatus(): SimulationStatus {
    return { ...this.status };
  }

  /**
   * Publishes a single test message for a sensor
   */
  public async publishTestMessage(
    macAddress: string,
    centerLat = 48.8566,
    centerLng = 2.3522,
    boundingBoxKm = 2
  ): Promise<SensorPayload> {
    // Use current time for test messages
    const sensorData = this.generateSensorData(
      macAddress,
      centerLat,
      centerLng,
      boundingBoxKm,
      Date.now()
    );

    await this.publishSensorData(sensorData);

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
  public validateConfig(config: SimulationConfig): string[] {
    const errors: string[] = [];

    if (!config.macAddresses || config.macAddresses.length === 0) {
      errors.push('MAC addresses array is required and cannot be empty');
    }

    if (!config.centerLat || config.centerLat < -90 || config.centerLat > 90) {
      errors.push('Center latitude must be between -90 and 90');
    }

    if (
      !config.centerLng ||
      config.centerLng < -180 ||
      config.centerLng > 180
    ) {
      errors.push('Center longitude must be between -180 and 180');
    }

    if (!config.boundingBoxKm || config.boundingBoxKm <= 0) {
      errors.push('Bounding box size must be greater than 0');
    }

    if (!config.intervalMs || config.intervalMs < 100) {
      errors.push('Interval must be at least 100ms');
    }

    if (!config.durationMinutes || config.durationMinutes <= 0) {
      errors.push('Duration must be greater than 0 minutes');
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
