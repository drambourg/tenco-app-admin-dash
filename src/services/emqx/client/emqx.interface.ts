export interface EmqxConfig {
  broker: string;
  port?: number;
  username?: string;
  password?: string;
  clientId?: string;
  qos?: 0 | 1 | 2;
  keepAlive?: number;
  connectTimeout?: number;
  reconnectPeriod?: number;
  protocolVersion?: number;
  useTls?: boolean;
  useWebSocket?: boolean;
}

export interface EmqxConnectionStatus {
  connected: boolean;
  connecting: boolean;
  error?: string;
  lastConnected?: Date;
  reconnectAttempts: number;
  isSimulationRunning?: boolean;
}
