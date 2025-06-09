/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { faker } from '@faker-js/faker';

import {
  Position,
  SensorConfig,
  SimulationConfig,
} from '../interfaces/data.interface';
import DataService from './data-simulator.service';
import DataGenerator from './utils/data-generator.utils';
import MovementSimulator from './utils/movement-simulator.utils';

export class IoTSimulator {
  private sensors: SensorConfig[] = [];
  private sensorPositions: Map<string, Position> = new Map();
  private sensorDirections: Map<string, 'north' | 'south' | 'east' | 'west'> =
    new Map();
  private isRunning = false;
  private intervals: NodeJS.Timeout[] = [];
  private simulationTimeout: NodeJS.Timeout | null = null;

  constructor(private config: SimulationConfig) {
    this.initializeSensors();
  }

  /**
   * Initializes sensors with provided MAC addresses
   */
  private initializeSensors(): void {
    console.log(
      `🚀 Initializing ${this.config.macAddresses.length} sensors...`
    );

    this.config.macAddresses.forEach((macAddress, i) => {
      // Random position within bounding box
      const startPosition: Position = {
        latitude: faker.number.float({
          max: this.config.boundingBox.north,
          min: this.config.boundingBox.south,
          multipleOf: 0.000001,
        }),
        longitude: faker.number.float({
          max: this.config.boundingBox.east,
          min: this.config.boundingBox.west,
          multipleOf: 0.000001,
        }),
      };

      // Random direction
      const directions: ('north' | 'south' | 'east' | 'west')[] = [
        'north',
        'south',
        'east',
        'west',
      ];
      const direction =
        directions[Math.floor(Math.random() * directions.length)];

      // Speed for 5km/h = 1.39 m/s approximately
      const speed = 1.39; // meters per second

      // Random start delay between 1 and 5 seconds
      const startDelay = faker.number.int({ max: 5000, min: 1000 });

      const sensor: SensorConfig = {
        direction,
        id: `sensor-${i + 1}`,
        isActive: false,
        macAddress,
        speed,
        startDelay,
        startPosition,
      };

      this.sensors.push(sensor);
      this.sensorPositions.set(sensor.id, startPosition);
      this.sensorDirections.set(sensor.id, direction);

      console.log(
        `📍 Sensor ${
          sensor.id
        } (${macAddress}) initialized at (${startPosition.latitude.toFixed(
          6
        )}, ${startPosition.longitude.toFixed(6)}) direction ${direction}`
      );
    });
  }

  /**
   * Starts simulation for a sensor
   */
  private startSensorSimulation(sensor: SensorConfig): void {
    console.log(
      `▶️ Starting simulation for sensor ${sensor.id} (delay: ${sensor.startDelay}ms)`
    );

    setTimeout(() => {
      // eslint-disable-next-line no-param-reassign
      sensor.isActive = true;
      console.log(`🟢 Sensor ${sensor.id} active`);

      const interval = setInterval(() => {
        this.simulateSensorData(sensor);
      }, this.config.sendIntervalMs);

      this.intervals.push(interval);
    }, sensor.startDelay);
  }

  /**
   * Simulates sensor data sending
   */
  private async simulateSensorData(sensor: SensorConfig): Promise<void> {
    if (!sensor.isActive || !this.isRunning) return;

    // Get current position
    const currentPosition = this.sensorPositions.get(sensor.id)!;
    const currentDirection = this.sensorDirections.get(sensor.id)!;

    // Update position with enhanced boundary handling
    const { newDirection, newPosition } =
      MovementSimulator.updateSensorPosition(
        { ...sensor, direction: currentDirection },
        currentPosition,
        this.config.boundingBox
      );

    // Save new position and direction
    this.sensorPositions.set(sensor.id, newPosition);
    this.sensorDirections.set(sensor.id, newDirection);

    // Generate sensor data
    const sensorData = DataGenerator.createSensorData(
      sensor.macAddress,
      newPosition
    );

    // Send to endpoints
    try {
      const { endpoints } = this.config;

      const successCount = await DataService.sendToAllEndpoints(
        endpoints,
        sensorData
      );

      console.log(
        `📊 Sensor ${sensor.id}: ${successCount}/${
          this.config.endpoints.length
        } endpoints OK - Position (${newPosition.latitude.toFixed(
          6
        )}, ${newPosition.longitude.toFixed(6)}) direction ${newDirection}`
      );
    } catch (error) {
      console.error(`❌ Error for sensor ${sensor.id}:`, error.message);
    }
  }

  /**
   * Starts the simulation
   */
  public start(): void {
    if (this.isRunning) {
      console.log('⚠️ Simulation already running');
      return;
    }

    console.log('🏁 Starting IoT simulation...');
    console.log(`📦 Configuration:`);
    console.log(`   - ${this.config.macAddresses.length} sensors`);
    console.log(`   - Duration: ${this.config.durationMinutes} minutes`);
    console.log(`   - Interval: ${this.config.sendIntervalMs}ms`);
    console.log(`   - Endpoints: ${this.config.endpoints.length}`);
    console.log(`   - Zone: ${JSON.stringify(this.config.boundingBox)}`);
    console.log(`   - MAC Addresses: ${this.config.macAddresses.join(', ')}`);

    this.isRunning = true;

    // Start each sensor with its delay
    this.sensors.forEach((sensor) => {
      this.startSensorSimulation(sensor);
    });

    // Schedule automatic stop
    this.simulationTimeout = setTimeout(() => {
      this.stop();
    }, this.config.durationMinutes * 60 * 1000);
  }

  /**
   * Stops the simulation
   */
  public stop(): void {
    if (!this.isRunning) {
      console.log('⚠️ Simulation already stopped');
      return;
    }

    console.log('🛑 Stopping simulation...');
    this.isRunning = false;

    // Stop all intervals
    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals = [];

    // Clear simulation timeout
    if (this.simulationTimeout) {
      clearTimeout(this.simulationTimeout);
      this.simulationTimeout = null;
    }

    // Deactivate all sensors
    this.sensors.forEach((sensor) => {
      // eslint-disable-next-line no-param-reassign
      sensor.isActive = false;
    });

    console.log('✅ Simulation stopped');
  }

  /**
   * Gets simulation status
   */
  public getStatus() {
    const activeSensors = this.sensors.filter((s) => s.isActive).length;

    return {
      activeSensors,
      config: this.config,
      isRunning: this.isRunning,
      sensorPositions: Array.from(this.sensorPositions.entries()).map(
        ([id, pos]) => ({
          direction: this.sensorDirections.get(id),
          id,
          macAddress: this.sensors.find((s) => s.id === id)?.macAddress,
          position: pos,
        })
      ),
      totalSensors: this.sensors.length,
    };
  }
}

export default IoTSimulator;
