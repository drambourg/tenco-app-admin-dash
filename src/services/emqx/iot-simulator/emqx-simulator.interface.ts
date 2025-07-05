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

export interface EnhancedSimulationConfig extends SimulationConfig {
  usePubSub?: boolean; // Nouvelle option pour Pub/Sub
  pubsubTopic?: string; // Topic Pub/Sub (défaut: sensor-data-topic)
}

export interface EnhancedSimulationStatus extends SimulationStatus {
  pubsubMessagesSent?: number;
  emqxMessagesSent?: number;
  pubsubErrors?: number;
  emqxErrors?: number;
}
