import { faker } from '@faker-js/faker';

import {
  DEFAULT_ACCURACY_MAX,
  DEFAULT_ACCURACY_MIN,
  DEFAULT_AMPLITUDE_MAX,
  DEFAULT_AMPLITUDE_MIN,
  DEFAULT_TEMPERATURE_MAX,
  DEFAULT_TEMPERATURE_MIN,
} from '../../config/default-config-simulator';
import {
  DataRanges,
  Position,
  SensorData,
  SensorPayload,
} from '../../interfaces/data.interface';

export class DataGenerator {
  /**
   * Generates realistic vibration data
   */
  static generateVibrationData(dataRanges?: DataRanges): number[] {
    const amplitudeMin = dataRanges?.amplitude?.min ?? DEFAULT_AMPLITUDE_MIN;
    const amplitudeMax = dataRanges?.amplitude?.max ?? DEFAULT_AMPLITUDE_MAX;

    const amplitude = faker.number.float({
      max: amplitudeMax,
      min: amplitudeMin,
      multipleOf: 1,
    });
    const frequency = faker.number.float({
      max: 1000,
      min: 10,
      multipleOf: 0.1,
    });

    return [frequency, amplitude];
  }

  /**
   * Generates realistic temperature
   */
  static generateTemperature(dataRanges?: DataRanges): number {
    const tempMin = dataRanges?.temperature?.min ?? DEFAULT_TEMPERATURE_MIN;
    const tempMax = dataRanges?.temperature?.max ?? DEFAULT_TEMPERATURE_MAX;

    return faker.number.float({ max: tempMax, min: tempMin, multipleOf: 0.1 });
  }

  /**
   * Generates realistic GPS accuracy
   */
  static generateAccuracy(dataRanges?: DataRanges): number {
    const accuracyMin = dataRanges?.accuracy?.min ?? DEFAULT_ACCURACY_MIN;
    const accuracyMax = dataRanges?.accuracy?.max ?? DEFAULT_ACCURACY_MAX;

    return faker.number.float({
      max: accuracyMax,
      min: accuracyMin,
      multipleOf: 0.1,
    });
  }

  /**
   * Creates complete sensor payload
   */
  static createSensorPayload(
    macAddress: string,
    position: Position,
    dataRanges?: DataRanges,
    dataCount = 1
  ): SensorPayload {
    const vibrations: number[][] = [];
    const temperatures: number[] = [];
    const coordinates: number[][] = [];
    const accuracies: number[] = [];
    const speeds: number[] = [];
    for (let i = 0; i < dataCount; i += 1) {
      vibrations.push(this.generateVibrationData(dataRanges));
      temperatures.push(this.generateTemperature(dataRanges));
      coordinates.push([position.latitude, position.longitude]);
      speeds.push(0);
      accuracies.push(this.generateAccuracy(dataRanges));
    }

    return {
      acc: accuracies,
      coord: coordinates,
      mac: macAddress,
      temp: temperatures,
      time: Math.floor(Date.now() / 1000),
      vib: vibrations,
    };
  }

  /**
   * Creates complete SensorData object
   */
  static createSensorData(macAddress: string, position: Position): SensorData {
    const timestamp = Math.floor(Date.now() / 1000);

    return {
      MACAddress: macAddress,
      payload: this.createSensorPayload(macAddress, position),
      timestamp,
    };
  }
}

export default DataGenerator;
