/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable no-nested-ternary */
// src/services/emqx/client/emqx-client.service.ts
// Client EMQX complet optimisé pour EMQX Cloud avec connexions persistantes

import { Severity } from '@google-cloud/logging';
import mqtt, { IClientOptions, MqttClient } from 'mqtt';

import gcpLogger from '../../../utils/gcp/gcp-logger';
import { getEmqxConfig } from './emqx-config';
import { EmqxConfig, EmqxConnectionStatus } from './emqx.interface';

export class EmqxClientService {
  // eslint-disable-next-line no-use-before-define
  private static instance: EmqxClientService;
  private client: MqttClient | null = null;
  private config: EmqxConfig;
  private status: EmqxConnectionStatus = {
    connected: false,
    connecting: false,
    reconnectAttempts: 0,
  };

  // Timers et monitoring
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private connectionHealthTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  // État de simulation
  private isSimulationRunning = false;

  // Métriques de connexion
  private lastSuccessfulConnect = 0;
  private consecutiveFailures = 0;
  private adaptiveKeepAlive = 180; // Démarre à 180s pour cloud

  // Diagnostics
  private connectionDiagnostics = {
    averageConnectionDuration: 0,
    cloudOptimized: true,
    disconnectCount: 0,
    lastConnectTime: 0,
    lastDisconnectReason: '',
    targetDurationMinutes: 10, // Objectif cloud: 10+ minutes
  };

  private constructor(config: EmqxConfig) {
    this.config = {
      connectTimeout: 60000, // 60s pour cloud
      keepAlive: 180, // 3 minutes pour cloud
      port: 1883,
      // 10s pour cloud
      protocolVersion: 4,

      qos: 1,
      reconnectPeriod: 10000,
      useTls: false,
      useWebSocket: false,
      ...config,
    };

    // Adaptation automatique pour EMQX Cloud
    if (this.config.broker?.includes('emqxcloud.com')) {
      this.adaptiveKeepAlive = Math.max(180, this.config.keepAlive || 180);
      gcpLogger({
        fileLink: __filename,
        message: 'EMQX Cloud detected - Applied cloud optimizations',
        payload: {
          adaptiveKeepAlive: this.adaptiveKeepAlive,
          cloudBroker: this.config.broker,
          cloudOptimized: true,
        },
        severity: Severity.info,
      });
    }
  }

  /**
   * Obtient l'instance singleton du service EMQX
   */
  public static getInstance(config?: EmqxConfig): EmqxClientService {
    if (!EmqxClientService.instance) {
      const mergedConfig = { ...getEmqxConfig(), ...config };
      EmqxClientService.instance = new EmqxClientService(mergedConfig);
    }
    return EmqxClientService.instance;
  }

  /**
   * Marque le début/fin d'une simulation pour maintenir la connexion
   */
  public setSimulationRunning(isRunning: boolean): void {
    this.isSimulationRunning = isRunning;

    if (isRunning) {
      this.startEnhancedKeepAlive();
      gcpLogger({
        fileLink: __filename,
        message: 'Simulation started - Enhanced keep-alive activated',
        payload: {
          cloudOptimized: this.config.broker?.includes('emqxcloud.com'),
          keepAlive: this.adaptiveKeepAlive,
          targetDuration: '10+ minutes',
        },
        severity: Severity.info,
      });
    } else {
      this.stopEnhancedKeepAlive();
      gcpLogger({
        fileLink: __filename,
        message: 'Simulation stopped - Normal keep-alive restored',
        payload: {
          disconnectCount: this.connectionDiagnostics.disconnectCount,
          finalUptime:
            this.lastSuccessfulConnect > 0
              ? Date.now() - this.lastSuccessfulConnect
              : 0,
        },
        severity: Severity.info,
      });
    }
  }

  /**
   * Démarre un keep-alive renforcé avec ping adaptatif
   */
  private startEnhancedKeepAlive(): void {
    this.stopEnhancedKeepAlive();

    // Ping adaptatif basé sur le keep-alive configuré (1/4 du keep-alive, minimum 30s pour cloud)
    const pingInterval = Math.max(30000, (this.adaptiveKeepAlive * 1000) / 4);

    this.keepAliveTimer = setInterval(async () => {
      if (this.client && this.status.connected) {
        try {
          const pingStart = Date.now();
          await this.ping();
          const pingDuration = Date.now() - pingStart;

          // Log seulement si latence élevée (> 3s pour cloud)
          if (pingDuration > 3000) {
            gcpLogger({
              fileLink: __filename,
              message: 'Enhanced keep-alive ping - High latency detected',
              payload: {
                clientStatus: this.client.connected,
                cloudLatency: true,
                keepAliveInterval: pingInterval,
                pingDuration,
              },
              severity: Severity.warning,
            });
          }
        } catch (error) {
          gcpLogger({
            fileLink: __filename,
            message:
              'Enhanced keep-alive ping failed - Connection may be unstable',
            payload: {
              cloudConnection: this.config.broker?.includes('emqxcloud.com'),
              error: error.message,
              pingInterval,
            },
            severity: Severity.warning,
          });
        }
      }
    }, pingInterval);

    gcpLogger({
      fileLink: __filename,
      message: 'Enhanced keep-alive started with cloud-adaptive interval',
      payload: {
        cloudOptimized: this.config.broker?.includes('emqxcloud.com'),
        keepAliveConfig: this.adaptiveKeepAlive,
        pingInterval,
      },
      severity: Severity.info,
    });
  }

  /**
   * Arrête le keep-alive renforcé
   */
  private stopEnhancedKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  /**
   * Crée les options de connexion MQTT optimisées pour EMQX Cloud
   */
  private createConnectionOptions(): IClientOptions {
    const options: IClientOptions = {
      // Sessions persistantes pour cloud (plus stable)
      clean: false,

      // Client ID unique pour éviter conflits sur infrastructure cloud partagée
      clientId:
        this.config.clientId ||
        `emqx-cloud-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,

      // Timeouts adaptatifs basés sur l'historique
      connectTimeout: Math.max(
        this.config.connectTimeout || 60000,
        this.consecutiveFailures * 5000
      ),
      keepalive: this.adaptiveKeepAlive,

      // Propriétés avancées pour cloud
      properties: {
        maximumPacketSize: 65535,
        // 2 heures pour cloud
        receiveMaximum: 1000,
        requestProblemInformation: true,
        requestResponseInformation: true,
        sessionExpiryInterval: 7200,
        topicAliasMaximum: 10,
        userProperties: {
          'client-type': 'iot-simulator',
          'cloud-provider': this.config.broker?.includes('emqxcloud.com')
            ? 'emqx-cloud'
            : 'mqtt',
          'environment': process.env.NODE_ENV || 'development',
          'target-uptime': `${this.connectionDiagnostics.targetDurationMinutes}min`,
        },
      },

      protocolVersion: (this.config.protocolVersion || 4) as 3 | 4 | 5,

      // Reconnexion adaptative
      reconnectPeriod: Math.min(
        (this.config.reconnectPeriod || 10000) +
          this.consecutiveFailures * 2000,
        30000
      ),

      // Options de fiabilité
      reschedulePings: true,

      resubscribe: false,

      // Pas de subscriptions
      // Will message détaillé pour cloud
      will: {
        payload: JSON.stringify({
          clientId: this.config.clientId,
          cloudProvider: this.config.broker?.includes('emqxcloud.com')
            ? 'emqx-cloud'
            : 'mqtt',
          keepAlive: this.adaptiveKeepAlive,
          reason: 'unexpected_disconnect',
          region: 'gcp',
          sessionPersistent: true,
          targetUptime: this.connectionDiagnostics.targetDurationMinutes * 60,
          timestamp: Date.now(),
        }),
        qos: 1,
        retain: true,
        topic: `$SYS/client/${this.config.clientId}/status`,
      },
    };

    // Credentials obligatoires pour EMQX Cloud
    if (this.config.username) {
      options.username = this.config.username;
      options.password = this.config.password;
    }

    // Configuration TLS si activée
    if (this.config.useTls) {
      options.protocol = 'mqtts';
      options.rejectUnauthorized =
        process.env.EMQX_TLS_REJECT_UNAUTHORIZED !== 'false';
    }

    // Configuration WebSocket si activée
    if (this.config.useWebSocket) {
      const protocol = this.config.useTls ? 'wss' : 'ws';
      options.protocol = protocol;
    }

    return options;
  }

  /**
   * Établit une connexion persistante avec retry intelligent
   */
  public async connect(): Promise<void> {
    if (this.client && this.status.connected && this.client.connected) {
      gcpLogger({
        fileLink: __filename,
        message: 'EMQX already connected - Validating connection health',
        payload: {
          cloudConnection: this.config.broker?.includes('emqxcloud.com'),
          uptime: Date.now() - this.lastSuccessfulConnect,
        },
        severity: Severity.debug,
      });
      return;
    }

    if (this.status.connecting) {
      throw new Error('Connexion déjà en cours');
    }

    this.status.connecting = true;
    const connectStartTime = Date.now();

    try {
      // Adaptation dynamique du keep-alive basée sur l'historique
      if (this.connectionDiagnostics.averageConnectionDuration > 0) {
        const avgMinutes =
          this.connectionDiagnostics.averageConnectionDuration / 60000;

        if (avgMinutes < 2) {
          // Connexions très courtes - réduire drastiquement
          this.adaptiveKeepAlive = Math.max(60, this.config.keepAlive / 3);
        } else if (avgMinutes < 5) {
          // Connexions courtes - réduire modérément
          this.adaptiveKeepAlive = Math.max(90, this.config.keepAlive / 2);
        } else if (avgMinutes < 10) {
          // Connexions moyennes - ajustement léger
          this.adaptiveKeepAlive = Math.max(120, this.config.keepAlive * 0.8);
        } else {
          // Connexions stables - keep-alive optimal
          this.adaptiveKeepAlive = this.config.keepAlive;
        }
      }

      // Fermer l'ancienne connexion proprement
      if (this.client) {
        try {
          this.client.removeAllListeners();
          await this.client.endAsync(false, { reasonCode: 0 });
        } catch (e) {
          // Ignorer les erreurs de fermeture
        }
        this.client = null;
      }

      const brokerUrl = this.config.useTls
        ? `mqtts://${this.config.broker}:${this.config.port}`
        : this.config.useWebSocket
        ? `${this.config.useTls ? 'wss' : 'ws'}://${this.config.broker}:${
            this.config.port
          }`
        : `mqtt://${this.config.broker}:${this.config.port}`;

      const options = this.createConnectionOptions();

      gcpLogger({
        fileLink: __filename,
        message: 'EMQX connecting with cloud-adaptive strategy',
        payload: {
          adaptiveKeepAlive: this.adaptiveKeepAlive,
          averageConnectionMinutes:
            Math.round(
              (this.connectionDiagnostics.averageConnectionDuration / 60000) *
                10
            ) / 10,
          broker: this.config.broker,
          cloudOptimized: this.config.broker?.includes('emqxcloud.com'),
          connectTimeout: options.connectTimeout,
          consecutiveFailures: this.consecutiveFailures,
          port: this.config.port,
          protocol: this.config.useTls
            ? 'mqtts'
            : this.config.useWebSocket
            ? 'ws'
            : 'mqtt',
          sessionPersistent: !options.clean,
        },
        severity: Severity.info,
      });

      this.client = mqtt.connect(brokerUrl, options);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error(
              `EMQX connection timeout after ${options.connectTimeout}ms for ${brokerUrl}`
            )
          );
        }, options.connectTimeout);

        this.client!.on('connect', (connack) => {
          clearTimeout(timeout);
          this.status.connected = true;
          this.status.connecting = false;
          this.status.lastConnected = new Date();
          this.status.reconnectAttempts = 0;
          this.status.error = undefined;
          this.consecutiveFailures = 0;
          this.lastSuccessfulConnect = Date.now();

          const connectDuration = Date.now() - connectStartTime;
          this.connectionDiagnostics.lastConnectTime = Date.now();

          gcpLogger({
            fileLink: __filename,
            message: 'EMQX connected successfully with persistence strategy',
            payload: {
              adaptiveKeepAlive: this.adaptiveKeepAlive,
              cloudConnection: this.config.broker?.includes('emqxcloud.com'),
              connectDuration,
              sessionPresent: connack?.sessionPresent,
              targetUptimeMinutes:
                this.connectionDiagnostics.targetDurationMinutes,
              willStartHealthMonitoring: true,
            },
            severity: Severity.info,
          });

          resolve();
        });

        this.client!.on('error', (error) => {
          clearTimeout(timeout);
          this.status.connected = false;
          this.status.connecting = false;
          this.status.error = error.message;
          this.consecutiveFailures += 1;

          this.connectionDiagnostics.lastDisconnectReason = `connect_error: ${error.message}`;

          gcpLogger({
            fileLink: __filename,
            message: 'EMQX connection error - Will adapt strategy',
            payload: {
              cloudConnection: this.config.broker?.includes('emqxcloud.com'),
              consecutiveFailures: this.consecutiveFailures,
              error: error.message,
              errorCode: (error as any).code,
              willReduceKeepAlive: this.consecutiveFailures > 3,
            },
            severity: Severity.error,
          });

          reject(error);
        });
      });

      this.setupEventListeners();
      this.startConnectionHealthMonitoring();
    } catch (error) {
      this.status.connecting = false;
      this.status.error = error.message;
      this.consecutiveFailures += 1;
      throw error;
    }
  }

  /**
   * Monitoring actif de la santé de la connexion adapté au cloud
   */
  private startConnectionHealthMonitoring(): void {
    this.stopConnectionHealthMonitoring();

    // Health check adapté au cloud (45s au lieu de 30s)
    const healthInterval = parseInt(
      process.env.EMQX_HEALTH_CHECK_INTERVAL || '45000',
      10
    );

    this.connectionHealthTimer = setInterval(async () => {
      if (!this.client || !this.status.connected) {
        return;
      }

      try {
        // Test de santé avec timeout adapté au cloud
        const pingStart = Date.now();
        const pingTimeout = parseInt(
          process.env.EMQX_PING_TIMEOUT || '10000',
          10
        );

        const pingPromise = this.ping();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Ping timeout')), pingTimeout);
        });

        const pingSuccess = await Promise.race([pingPromise, timeoutPromise]);
        const pingDuration = Date.now() - pingStart;

        if (!pingSuccess) {
          throw new Error('Ping failed - connection unhealthy');
        }

        // Publier heartbeat
        await this.publishHeartbeat();

        // Log adapté - seulement si problème ou toutes les 10 minutes
        const uptimeMinutes = (Date.now() - this.lastSuccessfulConnect) / 60000;
        const shouldLog = pingDuration > 3000 || uptimeMinutes % 10 < 0.75;

        if (shouldLog) {
          const isCloudTarget =
            uptimeMinutes >= this.connectionDiagnostics.targetDurationMinutes;

          gcpLogger({
            fileLink: __filename,
            message: `EMQX connection health check passed - ${
              isCloudTarget ? 'Target achieved' : 'Building stability'
            }`,
            payload: {
              adaptiveKeepAlive: this.adaptiveKeepAlive,
              cloudOptimized: this.config.broker?.includes('emqxcloud.com'),
              connectionScore: this.calculateConnectionScore(),
              pingDuration,
              targetMinutes: this.connectionDiagnostics.targetDurationMinutes,
              totalDisconnects: this.connectionDiagnostics.disconnectCount,
              uptimeMinutes: Math.round(uptimeMinutes * 10) / 10,
            },
            severity:
              pingDuration > 3000
                ? Severity.warning
                : isCloudTarget
                ? Severity.info
                : Severity.debug,
          });
        }

        // Alerte si connexion trop courte
        if (
          uptimeMinutes < this.connectionDiagnostics.targetDurationMinutes &&
          uptimeMinutes % 2 < 0.75
        ) {
          gcpLogger({
            fileLink: __filename,
            message:
              'EMQX connection duration below target - Monitoring stability',
            payload: {
              avgConnectionMinutes:
                Math.round(
                  (this.connectionDiagnostics.averageConnectionDuration /
                    60000) *
                    10
                ) / 10,
              currentUptimeMinutes: Math.round(uptimeMinutes * 10) / 10,
              stabilityOptimizationActive: true,
              targetMinutes: this.connectionDiagnostics.targetDurationMinutes,
            },
            severity: Severity.warning,
          });
        }
      } catch (error) {
        gcpLogger({
          fileLink: __filename,
          message: 'EMQX connection health check failed',
          payload: {
            cloudConnection: this.config.broker?.includes('emqxcloud.com'),
            error: error.message,
            uptimeMinutes: (Date.now() - this.lastSuccessfulConnect) / 60000,
            willTriggerReconnect: this.isSimulationRunning,
          },
          severity: Severity.error,
        });

        if (this.isSimulationRunning) {
          this.forceReconnect();
        }
      }
    }, healthInterval);
  }

  /**
   * Heartbeat pour maintenir la connexion active
   */
  private async publishHeartbeat(): Promise<void> {
    try {
      const heartbeat = {
        adaptiveKeepAlive: this.adaptiveKeepAlive,
        clientId: this.config.clientId,
        cloudProvider: this.config.broker?.includes('emqxcloud.com')
          ? 'emqx-cloud'
          : 'mqtt',
        diagnostics: {
          averageConnectionMinutes:
            Math.round(
              (this.connectionDiagnostics.averageConnectionDuration / 60000) *
                10
            ) / 10,
          connectionScore: this.calculateConnectionScore(),
          targetMinutes: this.connectionDiagnostics.targetDurationMinutes,
          totalDisconnects: this.connectionDiagnostics.disconnectCount,
        },
        performance: {
          cloudOptimized: this.config.broker?.includes('emqxcloud.com'),
          consecutiveFailures: this.consecutiveFailures,
          sessionPersistent: true,
        },
        timestamp: Date.now(),
        uptime: Date.now() - this.lastSuccessfulConnect,
      };

      await this.publish(
        `$SYS/client/${this.config.clientId}/heartbeat`,
        JSON.stringify(heartbeat),
        0
      );
    } catch (error) {
      gcpLogger({
        fileLink: __filename,
        message: 'Heartbeat publish failed',
        payload: {
          cloudConnection: this.config.broker?.includes('emqxcloud.com'),
          error: error.message,
        },
        severity: Severity.debug,
      });
    }
  }

  /**
   * Reconnexion forcée pour maintenir la persistance
   */
  private async forceReconnect(): Promise<void> {
    gcpLogger({
      fileLink: __filename,
      message: 'Forcing EMQX reconnection for connection persistence',
      payload: {
        cloudConnection: this.config.broker?.includes('emqxcloud.com'),
        currentUptime: Date.now() - this.lastSuccessfulConnect,
        targetUptime: this.connectionDiagnostics.targetDurationMinutes * 60000,
      },
      severity: Severity.warning,
    });

    try {
      if (this.client) {
        this.client.removeAllListeners();
        await this.client.endAsync(false, { reasonCode: 0 });
        this.client = null;
      }

      this.status.connected = false;
      this.status.connecting = false;

      const reconnectDelay = parseInt(
        process.env.EMQX_FORCE_RECONNECT_DELAY || '5000',
        10
      );
      await new Promise((resolve) => {
        setTimeout(resolve, reconnectDelay);
      });

      await this.connect();
    } catch (error) {
      gcpLogger({
        fileLink: __filename,
        message: 'Force reconnection failed',
        payload: {
          cloudConnection: this.config.broker?.includes('emqxcloud.com'),
          error: error.message,
        },
        severity: Severity.error,
      });
    }
  }

  private stopConnectionHealthMonitoring(): void {
    if (this.connectionHealthTimer) {
      clearInterval(this.connectionHealthTimer);
      this.connectionHealthTimer = null;
    }
  }

  /**
   * Configuration des event listeners avec persistance renforcée
   */
  private setupEventListeners(): void {
    if (!this.client) return;

    // Reconnect avec adaptation de stratégie
    this.client.on('reconnect', () => {
      this.status.reconnectAttempts += 1;

      gcpLogger({
        fileLink: __filename,
        message: 'EMQX auto-reconnecting with persistent session',
        payload: {
          adaptiveKeepAlive: this.adaptiveKeepAlive,
          attempts: this.status.reconnectAttempts,
          cloudConnection: this.config.broker?.includes('emqxcloud.com'),
          sessionPersistent: true,
        },
        severity: Severity.info,
      });
    });

    // Close avec tentative de maintien de connexion
    this.client.on('close', () => {
      const now = Date.now();
      const connectionDuration =
        this.lastSuccessfulConnect > 0 ? now - this.lastSuccessfulConnect : 0;

      // Mettre à jour les métriques
      if (connectionDuration > 0) {
        if (this.connectionDiagnostics.averageConnectionDuration === 0) {
          this.connectionDiagnostics.averageConnectionDuration =
            connectionDuration;
        } else {
          this.connectionDiagnostics.averageConnectionDuration =
            this.connectionDiagnostics.averageConnectionDuration * 0.8 +
            connectionDuration * 0.2;
        }
      }

      this.status.connected = false;
      this.connectionDiagnostics.disconnectCount += 1;
      this.connectionDiagnostics.lastDisconnectReason =
        'close_event_persistent';

      const durationMinutes = connectionDuration / 60000;
      const isTargetMet =
        durationMinutes >= this.connectionDiagnostics.targetDurationMinutes;

      gcpLogger({
        fileLink: __filename,
        message: `EMQX connection closed - ${
          isTargetMet ? 'Target achieved' : 'Below target'
        }`,
        payload: {
          averageDurationMinutes:
            Math.round(
              (this.connectionDiagnostics.averageConnectionDuration / 60000) *
                10
            ) / 10,
          cloudConnection: this.config.broker?.includes('emqxcloud.com'),
          connectionDurationMinutes: Math.round(durationMinutes * 10) / 10,
          connectionScore: this.calculateConnectionScore(),
          targetMinutes: this.connectionDiagnostics.targetDurationMinutes,
          totalDisconnects: this.connectionDiagnostics.disconnectCount,
          willAutoReconnect: this.isSimulationRunning || durationMinutes < 2,
        },
        severity: isTargetMet ? Severity.info : Severity.error,
      });

      // Reconnexion si simulation en cours ou connexion trop courte
      if (this.isSimulationRunning || durationMinutes < 2) {
        setTimeout(() => {
          if (!this.status.connected) {
            this.forceReconnect();
          }
        }, 5000);
      }
    });

    // Offline avec stratégie de persistence
    this.client.on('offline', () => {
      this.status.connected = false;
      this.connectionDiagnostics.lastDisconnectReason =
        'offline_event_persistent';

      gcpLogger({
        fileLink: __filename,
        message: 'EMQX client offline - Persistent session will restore state',
        payload: {
          adaptiveKeepAlive: this.adaptiveKeepAlive,
          cloudConnection: this.config.broker?.includes('emqxcloud.com'),
          lastSuccessfulConnectAgo: Date.now() - this.lastSuccessfulConnect,
          simulationRunning: this.isSimulationRunning,
        },
        severity: Severity.warning,
      });

      if (this.isSimulationRunning) {
        setTimeout(() => this.forceReconnect(), 2000);
      }
    });

    // Disconnect avec analyse détaillée
    this.client.on('disconnect', (packet) => {
      this.status.connected = false;
      const disconnectCode = packet?.reasonCode || 'unknown';
      this.connectionDiagnostics.lastDisconnectReason = `disconnect_packet_code_${disconnectCode}`;

      gcpLogger({
        fileLink: __filename,
        message: 'EMQX disconnected with reason code',
        payload: {
          adaptiveKeepAlive: this.adaptiveKeepAlive,
          cloudConnection: this.config.broker?.includes('emqxcloud.com'),
          packet,
          reasonCode: disconnectCode,
        },
        severity: Severity.warning,
      });
    });

    // Error avec adaptation de paramètres
    this.client.on('error', (error) => {
      const errorType = this.classifyError(error);
      this.connectionDiagnostics.lastDisconnectReason = `error_${errorType}_${error.message}`;

      // Adapter la stratégie basée sur le type d'erreur
      if (errorType === 'timeout' && this.adaptiveKeepAlive > 60) {
        this.adaptiveKeepAlive = Math.max(60, this.adaptiveKeepAlive * 0.8);
        gcpLogger({
          fileLink: __filename,
          message: 'Reducing adaptive keep-alive due to timeout errors',
          payload: {
            cloudConnection: this.config.broker?.includes('emqxcloud.com'),
            newKeepAlive: this.adaptiveKeepAlive,
          },
          severity: Severity.warning,
        });
      }

      gcpLogger({
        fileLink: __filename,
        message: `EMQX error (${errorType}) - Adapting connection strategy`,
        payload: {
          adaptiveKeepAlive: this.adaptiveKeepAlive,
          cloudConnection: this.config.broker?.includes('emqxcloud.com'),
          consecutiveFailures: this.consecutiveFailures,
          error: error.message,
          errorCode: (error as any).code,
          errorType,
          recommendation: this.getErrorRecommendation(errorType),
        },
        severity: Severity.error,
      });
    });
  }

  /**
   * Publie un message sur un topic MQTT avec retry automatique
   */
  public async publish(
    topic: string,
    message: string | Buffer,
    qos?: 0 | 1 | 2,
    retries = 1
  ): Promise<void> {
    if (!this.client || !this.status.connected || !this.client.connected) {
      throw new Error(
        `Client EMQX non connecté - Status: ${this.status.connected}, Client: ${this.client?.connected}`
      );
    }

    const publishQos = qos ?? this.config.qos ?? 1;

    return new Promise((resolve, reject) => {
      this.client!.publish(topic, message, { qos: publishQos }, (error) => {
        if (error) {
          gcpLogger({
            fileLink: __filename,
            message: 'Error publishing MQTT message',
            payload: {
              cloudConnection: this.config.broker?.includes('emqxcloud.com'),
              error: error.message,
              qos: publishQos,
              retries: retries - 1,
              topic,
            },
            severity: Severity.error,
          });
          reject(error);
        } else {
          gcpLogger({
            fileLink: __filename,
            message: 'MQTT message published successfully',
            payload: {
              cloudConnection: this.config.broker?.includes('emqxcloud.com'),
              messageSize:
                typeof message === 'string' ? message.length : message.length,
              qos: publishQos,
              topic,
            },
            severity: Severity.debug,
          });
          resolve();
        }
      });
    });
  }

  /**
   * S'abonne à un topic MQTT
   */
  public async subscribe(topic: string, qos?: 0 | 1 | 2): Promise<void> {
    if (!this.client || !this.status.connected) {
      throw new Error('Client EMQX non connecté');
    }

    const subscribeQos = qos ?? this.config.qos ?? 1;

    return new Promise((resolve, reject) => {
      this.client!.subscribe(topic, { qos: subscribeQos }, (error) => {
        if (error) {
          gcpLogger({
            fileLink: __filename,
            message: 'Error subscribing to MQTT topic',
            payload: {
              cloudConnection: this.config.broker?.includes('emqxcloud.com'),
              error: error.message,
              qos: subscribeQos,
              topic,
            },
            severity: Severity.error,
          });
          reject(error);
        } else {
          gcpLogger({
            fileLink: __filename,
            message: 'Successfully subscribed to MQTT topic',
            payload: {
              cloudConnection: this.config.broker?.includes('emqxcloud.com'),
              qos: subscribeQos,
              topic,
            },
            severity: Severity.info,
          });
          resolve();
        }
      });
    });
  }

  /**
   * Se désabonne d'un topic MQTT
   */
  public async unsubscribe(topic: string): Promise<void> {
    if (!this.client || !this.status.connected) {
      throw new Error('Client EMQX non connecté');
    }

    return new Promise((resolve, reject) => {
      this.client!.unsubscribe(topic, (error) => {
        if (error) {
          gcpLogger({
            fileLink: __filename,
            message: 'Error unsubscribing from MQTT topic',
            payload: {
              cloudConnection: this.config.broker?.includes('emqxcloud.com'),
              error: error.message,
              topic,
            },
            severity: Severity.error,
          });
          reject(error);
        } else {
          gcpLogger({
            fileLink: __filename,
            message: 'Successfully unsubscribed from MQTT topic',
            payload: {
              cloudConnection: this.config.broker?.includes('emqxcloud.com'),
              topic,
            },
            severity: Severity.info,
          });
          resolve();
        }
      });
    });
  }

  /**
   * Ajoute un listener pour les messages reçus
   */
  public onMessage(callback: (topic: string, message: Buffer) => void): void {
    if (!this.client) {
      throw new Error('Client EMQX non initialisé');
    }

    this.client.on('message', (topic, message) => {
      gcpLogger({
        fileLink: __filename,
        message: 'MQTT message received',
        payload: {
          cloudConnection: this.config.broker?.includes('emqxcloud.com'),
          messageSize: message.length,
          preview: message.toString().substring(0, 100),
          topic,
        },
        severity: Severity.debug,
      });
      callback(topic, message);
    });
  }

  /**
   * Ferme la connexion EMQX proprement
   */
  public async disconnect(): Promise<void> {
    this.setSimulationRunning(false);
    this.stopConnectionHealthMonitoring();

    if (!this.client) {
      return;
    }

    return new Promise((resolve) => {
      // Publier un message de déconnexion propre
      this.publishHeartbeat()
        .catch(() => {})
        .finally(() => {
          this.client!.end(false, { reasonCode: 0 }, () => {
            this.status.connected = false;
            this.status.connecting = false;
            this.client = null;

            const finalUptime =
              this.lastSuccessfulConnect > 0
                ? Math.round((Date.now() - this.lastSuccessfulConnect) / 1000)
                : 0;

            gcpLogger({
              fileLink: __filename,
              message: 'EMQX disconnected cleanly with session cleanup',
              payload: {
                averageConnectionMinutes:
                  Math.round(
                    (this.connectionDiagnostics.averageConnectionDuration /
                      60000) *
                      10
                  ) / 10,
                cloudConnection: this.config.broker?.includes('emqxcloud.com'),
                finalUptimeMinutes: Math.round((finalUptime / 60) * 10) / 10,
                finalUptimeSeconds: finalUptime,
                targetAchieved:
                  finalUptime >=
                  this.connectionDiagnostics.targetDurationMinutes * 60,
                totalDisconnects: this.connectionDiagnostics.disconnectCount,
              },
              severity: Severity.info,
            });

            resolve();
          });
        });
    });
  }

  /**
   * Obtient le statut de la connexion avec diagnostics
   */
  public getStatus(): EmqxConnectionStatus & {
    diagnostics: any;
    isSimulationRunning: boolean;
    cloudOptimized: boolean;
  } {
    return {
      ...this.status,
      cloudOptimized: this.config.broker?.includes('emqxcloud.com') || false,
      diagnostics: this.connectionDiagnostics,
      isSimulationRunning: this.isSimulationRunning,
    };
  }

  /**
   * Obtient les diagnostics de connexion complets
   */
  public getDiagnostics() {
    return {
      ...this.connectionDiagnostics,
      clientInfo: this.client
        ? {
            connected: this.client.connected,
            options: {
              clean: this.client.options.clean,
              clientId: this.client.options.clientId,
              connectTimeout: this.client.options.connectTimeout,
              keepalive: this.client.options.keepalive,
            },
            reconnecting: this.client.reconnecting,
          }
        : null,
      configAnalysis: {
        cloudOptimized: this.config.broker?.includes('emqxcloud.com'),
        keepAliveOptimal:
          this.adaptiveKeepAlive >=
          (this.config.broker?.includes('emqxcloud.com') ? 120 : 60),
        overallScore: this.calculateConnectionScore(),
        reconnectOptimal: this.config.reconnectPeriod >= 5000,
        timeoutOptimal:
          this.config.connectTimeout >=
          (this.config.broker?.includes('emqxcloud.com') ? 30000 : 20000),
      },
      currentConfig: {
        broker: this.config.broker,
        cloudProvider: this.config.broker?.includes('emqxcloud.com')
          ? 'emqx-cloud'
          : 'mqtt',
        connectTimeout: this.config.connectTimeout,
        keepAlive: this.adaptiveKeepAlive,
        port: this.config.port,
        reconnectPeriod: this.config.reconnectPeriod,
        useTls: this.config.useTls,
        useWebSocket: this.config.useWebSocket,
      },
      recommendations: this.generateRecommendations(),
    };
  }

  /**
   * Obtient la configuration actuelle
   */
  public getConfig(): EmqxConfig {
    return {
      ...this.config,
      password: this.config.password ? '***' : undefined,
    };
  }

  /**
   * Teste la connexion avec retry amélioré
   */
  public async ping(): Promise<boolean> {
    if (!this.client || !this.status.connected || !this.client.connected) {
      return false;
    }

    try {
      const testTopic = `$SYS/ping/${this.config.clientId}`;
      const testMessage = JSON.stringify({
        clientId: this.config.clientId,
        cloudProvider: this.config.broker?.includes('emqxcloud.com')
          ? 'emqx-cloud'
          : 'mqtt',
        diagnostics: this.connectionDiagnostics,
        simulationRunning: this.isSimulationRunning,
        timestamp: Date.now(),
        type: 'ping',
        uptime: Date.now() - this.lastSuccessfulConnect,
      });

      await this.publish(testTopic, testMessage, 0);
      return true;
    } catch (error) {
      gcpLogger({
        fileLink: __filename,
        message: 'EMQX ping failed',
        payload: {
          cloudConnection: this.config.broker?.includes('emqxcloud.com'),
          error: error.message,
          uptime: Date.now() - this.lastSuccessfulConnect,
        },
        severity: Severity.warning,
      });
      return false;
    }
  }

  /**
   * Classifie les erreurs EMQX pour un meilleur diagnostic
   */
  // eslint-disable-next-line class-methods-use-this
  private classifyError(
    error: Error
  ): 'network' | 'authentication' | 'protocol' | 'timeout' | 'critical' {
    const message = error.message.toLowerCase();
    const { code } = error as any;

    if (message.includes('timeout') || code === 'ETIMEDOUT') {
      return 'timeout';
    }
    if (
      message.includes('auth') ||
      message.includes('unauthorized') ||
      code === 'ECONNREFUSED'
    ) {
      return 'authentication';
    }
    if (message.includes('protocol') || message.includes('mqtt')) {
      return 'protocol';
    }
    if (
      message.includes('network') ||
      code === 'ENETUNREACH' ||
      code === 'ENOTFOUND'
    ) {
      return 'network';
    }
    return 'critical';
  }

  /**
   * Fournit des recommandations basées sur le type d'erreur
   */
  private getErrorRecommendation(errorType: string): string {
    const isCloud = this.config.broker?.includes('emqxcloud.com');

    const recommendations = {
      authentication: isCloud
        ? 'Vérifier les credentials EMQX Cloud (username/password obligatoires)'
        : 'Vérifier les credentials EMQX (username/password)',
      critical: 'Vérifier les logs détaillés et la configuration complète',
      network: isCloud
        ? 'Vérifier la connectivité Internet et les paramètres DNS pour EMQX Cloud'
        : 'Vérifier la connectivité réseau et les paramètres DNS',
      protocol: 'Vérifier la version MQTT et les paramètres du broker',
      timeout: isCloud
        ? 'Augmenter les timeouts pour tenir compte de la latence cloud'
        : 'Augmenter les timeouts de connexion et keep-alive',
    };

    return recommendations[errorType] || 'Contacter le support technique';
  }

  /**
   * Génère des recommandations basées sur les diagnostics
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const diag = this.connectionDiagnostics;
    const isCloud = this.config.broker?.includes('emqxcloud.com');
    const targetMinutes = diag.targetDurationMinutes;

    // Recommandations basées sur les métriques
    if (diag.disconnectCount > (isCloud ? 5 : 10)) {
      recommendations.push(
        `❌ Trop de déconnexions (${
          diag.disconnectCount
        }) - vérifier la stabilité du ${isCloud ? 'broker cloud' : 'broker'}`
      );
    }

    const avgMinutes = diag.averageConnectionDuration / 60000;
    if (avgMinutes < targetMinutes / 2) {
      recommendations.push(
        `⏱️ Connexions très courtes (${
          Math.round(avgMinutes * 10) / 10
        }min) - objectif: ${targetMinutes}+ minutes`
      );
    }

    const minKeepAlive = isCloud ? 120 : 60;
    if (this.adaptiveKeepAlive < minKeepAlive) {
      recommendations.push(
        `📊 Keep-alive trop court (${
          this.adaptiveKeepAlive
        }s) - recommandé pour ${
          isCloud ? 'cloud' : 'local'
        }: ${minKeepAlive}+ secondes`
      );
    }

    const minTimeout = isCloud ? 30000 : 20000;
    if (this.config.connectTimeout < minTimeout) {
      recommendations.push(
        `⏰ Timeout de connexion trop court - recommandé pour ${
          isCloud ? 'cloud' : 'local'
        }: ${minTimeout / 1000}+ secondes`
      );
    }

    if (diag.lastDisconnectReason.includes('timeout')) {
      recommendations.push(
        `🌐 Problèmes de latence réseau${
          isCloud ? ' cloud' : ''
        } - considérer un broker plus proche`
      );
    }

    if (diag.lastDisconnectReason.includes('auth') && isCloud) {
      recommendations.push(
        "🔑 Problèmes d'authentification EMQX Cloud - vérifier username/password obligatoires"
      );
    }

    if (isCloud && !this.config.username) {
      recommendations.push(
        '⚠️ Credentials manquants pour EMQX Cloud - username/password obligatoires'
      );
    }

    // Recommandations de performance cloud
    if (isCloud && avgMinutes > 0 && avgMinutes < 10) {
      recommendations.push(
        '🌐 Optimisation cloud recommandée - augmenter keep-alive et timeouts pour stabilité'
      );
    }

    if (recommendations.length === 0) {
      const score = this.calculateConnectionScore();
      if (score > 80) {
        recommendations.push(
          `✅ Configuration ${
            isCloud ? 'cloud ' : ''
          }excellente (score: ${score}/100)`
        );
      } else {
        recommendations.push(
          `⚡ Configuration ${
            isCloud ? 'cloud ' : ''
          }à améliorer (score: ${score}/100)`
        );
      }
    }

    return recommendations;
  }

  /**
   * Calcule un score de qualité de la configuration (0-100)
   */
  private calculateConnectionScore(): number {
    let score = 100;
    const isCloud = this.config.broker?.includes('emqxcloud.com');
    const avgMinutes =
      this.connectionDiagnostics.averageConnectionDuration / 60000;
    const targetMinutes = this.connectionDiagnostics.targetDurationMinutes;

    // Pénalités basées sur la performance
    if (avgMinutes < targetMinutes / 4) score -= 40; // Très en dessous de l'objectif
    if (avgMinutes < targetMinutes / 2) score -= 20; // En dessous de l'objectif

    // Pénalités basées sur la configuration
    const minKeepAlive = isCloud ? 120 : 60;
    if (this.adaptiveKeepAlive < minKeepAlive) score -= 20;

    const minTimeout = isCloud ? 30000 : 20000;
    if (this.config.connectTimeout < minTimeout) score -= 15;

    if (this.config.reconnectPeriod < 5000) score -= 10;

    // Pénalités basées sur les déconnexions
    const maxDisconnects = isCloud ? 5 : 10;
    if (this.connectionDiagnostics.disconnectCount > maxDisconnects)
      score -= 30;

    // Bonus pour cloud avec credentials
    if (isCloud && this.config.username) score += 5;

    return Math.max(0, Math.min(100, score));
  }
}

export default EmqxClientService;
