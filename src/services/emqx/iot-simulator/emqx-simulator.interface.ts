export interface SimulationConfig {
  macAddresses: string[];
  centerLat: number;
  centerLng: number;
  boundingBoxKm: number;
  intervalMs: number;
  durationMinutes: number;
  debugMode?: boolean;
}

export interface SimulationStatus {
  isRunning: boolean;
  startTime?: Date;
  endTime?: Date;
  totalSensors: number;
  messagesSent: number;
  errors: number;
  elapsedSeconds: number;
  nextSendTime?: Date;
}
