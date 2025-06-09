export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface Position {
  latitude: number;
  longitude: number;
}

export interface VibrationData {
  frequency: number;
  amplitude: number;
}

export interface CoordinateData {
  latitude: number;
  longitude: number;
}

export interface SensorPayload {
  acqtime: number;
  MACAddress: string;
  vibrations: VibrationData[];
  temperatures: number[];
  coordinates: CoordinateData[];
  accuracies: number[];
}

export interface SensorData {
  timestamp: number;
  MACAddress: string;
  payload: SensorPayload;
}

export interface SensorConfig {
  id: string;
  macAddress: string;
  startPosition: Position;
  direction: 'north' | 'south' | 'east' | 'west';
  speed: number; // meters per second
  isActive: boolean;
  startDelay: number; // milliseconds
}

export interface SimulationConfig {
  boundingBox: BoundingBox;
  durationMinutes: number;
  macAddresses: string[];
  endpoints: string[];
  sendIntervalMs: number;
}

export interface DataRanges {
  amplitude?: {
    min: number;
    max: number;
  };
  temperature?: {
    min: number;
    max: number;
  };
  accuracy?: {
    min: number;
    max: number;
  };
}
