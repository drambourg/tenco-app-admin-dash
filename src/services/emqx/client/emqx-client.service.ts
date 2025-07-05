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
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isSimulationRunning = false;
  private connectionDiagnostics = {
    averageConnectionDuration: 0,
    disconnectCount: 0,
    lastConnectTime: 0,
    lastDisconnectReason: '',
  };

  private constructor(config: EmqxConfig) {
    this.config = {
      connectTimeout: 30000,
      keepAlive: 30, // RÉDUIT à 30 secondes pour test
      port: 1883,
      qos: 1,
      reconnectPeriod: 5000,
      ...config,
    };
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
      // Démarrer le keep-alive renforcé pendant la simulation
      this.startEnhancedKeepAlive();
      gcpLogger({
        fileLink: __filename,
        message: 'Simulation started - Enhanced keep-alive activated',
        payload: {
          diagnostics: this.connectionDiagnostics,
          keepAlive: this.config.keepAlive,
        },
        severity: Severity.info,
      });
    } else {
      // Arrêter le keep-alive renforcé
      this.stopEnhancedKeepAlive();
      gcpLogger({
        fileLink: __filename,
        message: 'Simulation stopped - Normal keep-alive restored',
        payload: { diagnostics: this.connectionDiagnostics },
        severity: Severity.info,
      });
    }
  }

  /**
   * Démarre un keep-alive renforcé pendant les simulations
   */
  private startEnhancedKeepAlive(): void {
    this.stopEnhancedKeepAlive(); // Arrêter l'ancien timer s'il existe

    // Ping très fréquent pour debug (toutes les 15 secondes)
    this.keepAliveTimer = setInterval(async () => {
      if (this.client && this.status.connected) {
        try {
          const pingStart = Date.now();
          await this.ping();
          const pingDuration = Date.now() - pingStart;

          gcpLogger({
            fileLink: __filename,
            message: 'Enhanced keep-alive ping successful',
            payload: {
              clientConnected: this.client.connected,
              clientReconnecting: this.client.reconnecting,
              pingDuration,
            },
            severity: Severity.debug,
          });
        } catch (error) {
          gcpLogger({
            fileLink: __filename,
            message: 'Enhanced keep-alive ping failed',
            payload: {
              clientConnected: this.client?.connected,
              diagnostics: this.connectionDiagnostics,
              error: error.message,
            },
            severity: Severity.warning,
          });

          // Ne pas forcer la reconnexion ici, laisser MQTT gérer
        }
      } else {
        gcpLogger({
          fileLink: __filename,
          message: 'Keep-alive skipped - client not ready',
          payload: {
            clientConnected: this.client?.connected,
            clientExists: !!this.client,
            statusConnected: this.status.connected,
          },
          severity: Severity.warning,
        });
      }
    }, 15000); // Toutes les 15 secondes pour debug
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
   * Crée les options de connexion MQTT avec debug amélioré
   */
  private createConnectionOptions(): IClientOptions {
    const options: IClientOptions = {
      clean: true, // REMIS à true pour éviter les sessions persistantes problématiques
      clientId: this.config.clientId || `emqx-client-${Date.now()}`,
      connectTimeout: this.config.connectTimeout,
      keepalive: this.config.keepAlive,
      protocolVersion: 4,

      reconnectPeriod: this.config.reconnectPeriod,
      // Désactivé car on ne s'abonne à rien
      reschedulePings: true,
      resubscribe: false, // MQTT 3.1.1
      // Nouvelles options pour debug
      will: {
        payload: JSON.stringify({
          clientId: this.config.clientId,
          reason: 'unexpected_disconnect',
          timestamp: Date.now(),
        }),
        qos: 0,
        retain: false,
        topic: `$SYS/client/${this.config.clientId}/disconnect`,
      },
    };

    // Ajout des credentials si fournis
    if (this.config.username) {
      options.username = this.config.username;
      options.password = this.config.password;
    }

    return options;
  }

  /**
   * Établit la connexion au broker EMQX avec diagnostics améliorés
   */
  public async connect(): Promise<void> {
    if (this.client && this.status.connected && this.client.connected) {
      gcpLogger({
        fileLink: __filename,
        message: 'EMQX already connected',
        payload: { diagnostics: this.connectionDiagnostics },
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
      // Fermer l'ancienne connexion si elle existe
      if (this.client) {
        try {
          this.client.removeAllListeners();
          await this.client.endAsync();
        } catch (e) {
          // Ignorer les erreurs de fermeture
        }
        this.client = null;
      }

      // Construction de l'URL broker
      const brokerUrl = `mqtt://${this.config.broker}:${this.config.port}`;
      const options = this.createConnectionOptions();

      gcpLogger({
        fileLink: __filename,
        message: 'Tentative de connexion EMQX avec diagnostics',
        payload: {
          broker: this.config.broker,
          brokerUrl,
          clean: options.clean,
          clientId: options.clientId,
          connectTimeout: options.connectTimeout,
          diagnostics: this.connectionDiagnostics,
          keepAlive: options.keepalive,
          port: this.config.port,
          protocolVersion: options.protocolVersion,
          username: this.config.username ? '***' : undefined,
        },
        severity: Severity.info,
      });

      this.client = mqtt.connect(brokerUrl, options);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error(
              `Timeout de connexion EMQX après ${this.config.connectTimeout}ms pour ${brokerUrl}`
            )
          );
        }, this.config.connectTimeout);

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.client!.on('connect', (connack) => {
          clearTimeout(timeout);
          this.status.connected = true;
          this.status.connecting = false;
          this.status.lastConnected = new Date();
          this.status.reconnectAttempts = 0;
          this.status.error = undefined;

          const connectDuration = Date.now() - connectStartTime;
          this.connectionDiagnostics.lastConnectTime = Date.now();

          gcpLogger({
            fileLink: __filename,
            message: 'Connexion EMQX établie avec succès',
            payload: {
              brokerUrl,
              clientId: options.clientId,
              connectDuration,
              diagnostics: this.connectionDiagnostics,
              returnCode: connack?.returnCode,
              sessionPresent: connack?.sessionPresent,
            },
            severity: Severity.info,
          });

          resolve();
        });

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.client!.on('error', (error) => {
          clearTimeout(timeout);
          this.status.connected = false;
          this.status.connecting = false;
          this.status.error = error.message;
          this.status.reconnectAttempts += 1;

          this.connectionDiagnostics.lastDisconnectReason = `connect_error: ${error.message}`;

          gcpLogger({
            fileLink: __filename,
            message: 'Erreur de connexion EMQX',
            payload: {
              attempts: this.status.reconnectAttempts,
              brokerUrl,
              diagnostics: this.connectionDiagnostics,
              error: error.message,
              errorCode: (error as any).code,
            },
            severity: Severity.error,
          });

          reject(error);
        });
      });

      // Configuration des event listeners après connexion réussie
      this.setupEventListeners();
    } catch (error) {
      this.status.connecting = false;
      this.status.error = error.message;
      throw error;
    }
  }

  /**
   * Configure les event listeners avec diagnostics détaillés
   */
  private setupEventListeners(): void {
    if (!this.client) return;

    this.client.on('reconnect', () => {
      this.status.reconnectAttempts += 1;
      gcpLogger({
        fileLink: __filename,
        message: 'Tentative de reconnexion EMQX automatique',
        payload: {
          attempts: this.status.reconnectAttempts,
          diagnostics: this.connectionDiagnostics,
        },
        severity: Severity.warning,
      });
    });

    this.client.on('close', () => {
      const now = Date.now();
      if (this.connectionDiagnostics.lastConnectTime > 0) {
        const connectionDuration =
          now - this.connectionDiagnostics.lastConnectTime;
        this.connectionDiagnostics.averageConnectionDuration =
          (this.connectionDiagnostics.averageConnectionDuration +
            connectionDuration) /
          2;
      }

      this.status.connected = false;
      this.connectionDiagnostics.disconnectCount += 1;
      this.connectionDiagnostics.lastDisconnectReason = 'close_event';

      gcpLogger({
        fileLink: __filename,
        message: 'Connexion EMQX fermée',
        payload: {
          diagnostics: this.connectionDiagnostics,
          isSimulationRunning: this.isSimulationRunning,
          willAttemptReconnect: this.isSimulationRunning,
        },
        severity: Severity.warning,
      });
    });

    this.client.on('offline', () => {
      this.status.connected = false;
      this.connectionDiagnostics.lastDisconnectReason = 'offline_event';

      gcpLogger({
        fileLink: __filename,
        message: 'Client EMQX hors ligne',
        payload: {
          diagnostics: this.connectionDiagnostics,
          isSimulationRunning: this.isSimulationRunning,
        },
        severity: Severity.warning,
      });
    });

    this.client.on('disconnect', (packet) => {
      this.status.connected = false;
      this.connectionDiagnostics.lastDisconnectReason = `disconnect_packet: ${JSON.stringify(
        packet
      )}`;

      gcpLogger({
        fileLink: __filename,
        message: 'Client EMQX déconnecté par packet',
        payload: {
          diagnostics: this.connectionDiagnostics,
          isSimulationRunning: this.isSimulationRunning,
          packet,
        },
        severity: Severity.warning,
      });
    });

    // Gestion des erreurs en continu
    this.client.on('error', (error) => {
      this.connectionDiagnostics.lastDisconnectReason = `runtime_error: ${error.message}`;

      gcpLogger({
        fileLink: __filename,
        message: 'Erreur EMQX continue',
        payload: {
          diagnostics: this.connectionDiagnostics,
          error: error.message,
          errorCode: (error as any).code,
          isSimulationRunning: this.isSimulationRunning,
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
    retries = 1 // RÉDUIT à 1 retry pour éviter les boucles
  ): Promise<void> {
    if (!this.client || !this.status.connected || !this.client.connected) {
      throw new Error(
        `Client EMQX non connecté - Status: ${this.status.connected}, Client: ${this.client?.connected}`
      );
    }

    const publishQos = qos ?? this.config.qos ?? 1;

    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.client!.publish(topic, message, { qos: publishQos }, (error) => {
        if (error) {
          gcpLogger({
            fileLink: __filename,
            message: 'Erreur lors de la publication MQTT',
            payload: {
              diagnostics: this.connectionDiagnostics,
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
            message: 'Message MQTT publié avec succès',
            payload: {
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
   * Obtient le statut de la connexion avec diagnostics
   */
  public getStatus(): EmqxConnectionStatus & { diagnostics: any } {
    return {
      ...this.status,
      diagnostics: this.connectionDiagnostics,
      isSimulationRunning: this.isSimulationRunning,
    };
  }

  /**
   * Obtient les diagnostics de connexion
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
              keepalive: this.client.options.keepalive,
            },
            reconnecting: this.client.reconnecting,
          }
        : null,
      currentConfig: {
        broker: this.config.broker,
        connectTimeout: this.config.connectTimeout,
        keepAlive: this.config.keepAlive,
        port: this.config.port,
        reconnectPeriod: this.config.reconnectPeriod,
      },
    };
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
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.client!.subscribe(topic, { qos: subscribeQos }, (error) => {
        if (error) {
          gcpLogger({
            fileLink: __filename,
            message: "Erreur lors de l'abonnement MQTT",
            payload: { error: error.message, qos: subscribeQos, topic },
            severity: Severity.error,
          });
          reject(error);
        } else {
          gcpLogger({
            fileLink: __filename,
            message: 'Abonnement MQTT réussi',
            payload: { qos: subscribeQos, topic },
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
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.client!.unsubscribe(topic, (error) => {
        if (error) {
          gcpLogger({
            fileLink: __filename,
            message: 'Erreur lors du désabonnement MQTT',
            payload: { error: error.message, topic },
            severity: Severity.error,
          });
          reject(error);
        } else {
          gcpLogger({
            fileLink: __filename,
            message: 'Désabonnement MQTT réussi',
            payload: { topic },
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
        message: 'Message MQTT reçu',
        payload: {
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
    // Marquer qu'aucune simulation n'est en cours
    this.setSimulationRunning(false);

    if (!this.client) {
      return;
    }

    return new Promise((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.client!.end(false, {}, () => {
        this.status.connected = false;
        this.status.connecting = false;
        this.client = null;

        gcpLogger({
          fileLink: __filename,
          message: 'Connexion EMQX fermée proprement',
          payload: { diagnostics: this.connectionDiagnostics },
          severity: Severity.info,
        });

        resolve();
      });
    });
  }

  /**
   * Obtient la configuration actuelle
   */
  public getConfig(): EmqxConfig {
    return {
      ...this.config,
      password: this.config.password ? '***' : undefined, // Masquer le mot de passe
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
      // Publier un message de test sur un topic spécial
      const testTopic = `$SYS/ping/${this.config.clientId}`;
      const testMessage = JSON.stringify({
        clientId: this.config.clientId,
        diagnostics: this.connectionDiagnostics,
        simulationRunning: this.isSimulationRunning,
        timestamp: Date.now(),
        type: 'ping',
      });

      await this.publish(testTopic, testMessage, 0);
      return true;
    } catch (error) {
      gcpLogger({
        fileLink: __filename,
        message: 'Échec du ping EMQX',
        payload: {
          diagnostics: this.connectionDiagnostics,
          error: error.message,
        },
        severity: Severity.warning,
      });
      return false;
    }
  }
}

export default EmqxClientService;
