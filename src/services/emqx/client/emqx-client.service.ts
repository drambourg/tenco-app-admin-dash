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

  private constructor(config: EmqxConfig) {
    this.config = {
      connectTimeout: 30000, // Augmenté de 10s à 30s
      keepAlive: 300, // Augmenté de 60s à 5 minutes (300s)
      port: 1883,
      qos: 1,
      reconnectPeriod: 5000, // Reconnexion toutes les 5s
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
        payload: { keepAlive: this.config.keepAlive },
        severity: Severity.info,
      });
    } else {
      // Arrêter le keep-alive renforcé
      this.stopEnhancedKeepAlive();
      gcpLogger({
        fileLink: __filename,
        message: 'Simulation stopped - Normal keep-alive restored',
        severity: Severity.info,
      });
    }
  }

  /**
   * Démarre un keep-alive renforcé pendant les simulations
   */
  private startEnhancedKeepAlive(): void {
    this.stopEnhancedKeepAlive(); // Arrêter l'ancien timer s'il existe

    // Ping moins fréquent avec keep-alive plus long (toutes les 2 minutes)
    this.keepAliveTimer = setInterval(async () => {
      if (this.client && this.status.connected) {
        try {
          await this.ping();
          gcpLogger({
            fileLink: __filename,
            message: 'Enhanced keep-alive ping successful',
            severity: Severity.debug,
          });
        } catch (error) {
          gcpLogger({
            fileLink: __filename,
            message: 'Enhanced keep-alive ping failed, attempting reconnection',
            payload: { error: error.message },
            severity: Severity.warning,
          });

          // Tentative de reconnexion immédiate si le ping échoue
          this.attemptReconnection();
        }
      }
    }, 120000); // Toutes les 2 minutes pendant la simulation (au lieu de 30s)
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
   * Tentative de reconnexion automatique
   */
  private async attemptReconnection(): Promise<void> {
    if (this.reconnectTimer) {
      return; // Reconnexion déjà en cours
    }

    this.reconnectTimer = setTimeout(async () => {
      try {
        gcpLogger({
          fileLink: __filename,
          message: 'Attempting automatic reconnection',
          severity: Severity.info,
        });

        await this.connect();
        this.reconnectTimer = null;

        gcpLogger({
          fileLink: __filename,
          message: 'Automatic reconnection successful',
          severity: Severity.info,
        });
      } catch (error) {
        this.reconnectTimer = null;
        gcpLogger({
          fileLink: __filename,
          message: 'Automatic reconnection failed',
          payload: { error: error.message },
          severity: Severity.error,
        });
      }
    }, 5000); // Attendre 5 secondes avant de tenter la reconnexion (au lieu de 2s)
  }

  /**
   * Crée les options de connexion MQTT avec paramètres optimisés
   */
  private createConnectionOptions(): IClientOptions {
    const options: IClientOptions = {
      clean: false, // Changé à false pour maintenir la session
      clientId: this.config.clientId || `emqx-client-${Date.now()}`,
      connectTimeout: this.config.connectTimeout,
      keepalive: this.config.keepAlive,
      protocolVersion: 4,

      reconnectPeriod: this.config.reconnectPeriod,

      // Ajout d'options pour une connexion plus stable
      reschedulePings: true,
      resubscribe: true, // MQTT 3.1.1 pour meilleure compatibilité
    };

    // Ajout des credentials si fournis
    if (this.config.username) {
      options.username = this.config.username;
      options.password = this.config.password;
    }

    return options;
  }

  /**
   * Établit la connexion au broker EMQX avec gestion améliorée
   */
  public async connect(): Promise<void> {
    if (this.client && this.status.connected && this.client.connected) {
      gcpLogger({
        fileLink: __filename,
        message: 'EMQX already connected',
        severity: Severity.debug,
      });
      return;
    }

    if (this.status.connecting) {
      throw new Error('Connexion déjà en cours');
    }

    this.status.connecting = true;

    try {
      // Fermer l'ancienne connexion si elle existe
      if (this.client) {
        try {
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
        message: 'Tentative de connexion EMQX avec paramètres optimisés',
        payload: {
          broker: this.config.broker,
          brokerUrl,
          clean: options.clean,
          clientId: options.clientId,
          keepAlive: options.keepalive,
          port: this.config.port,
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
        }, this.config.connectTimeout); // Maintenant 30 secondes au lieu de 10

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.client!.on('connect', () => {
          clearTimeout(timeout);
          this.status.connected = true;
          this.status.connecting = false;
          this.status.lastConnected = new Date();
          this.status.reconnectAttempts = 0;
          this.status.error = undefined;

          gcpLogger({
            fileLink: __filename,
            message: 'Connexion EMQX établie avec succès',
            payload: {
              brokerUrl,
              clientId: options.clientId,
              sessionPresent: this.client?.connected,
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

          gcpLogger({
            fileLink: __filename,
            message: 'Erreur de connexion EMQX',
            payload: {
              attempts: this.status.reconnectAttempts,
              brokerUrl,
              error: error.message,
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
   * Configure les event listeners pour le client MQTT avec gestion améliorée
   */
  private setupEventListeners(): void {
    if (!this.client) return;

    this.client.on('reconnect', () => {
      this.status.reconnectAttempts += 1;
      gcpLogger({
        fileLink: __filename,
        message: 'Tentative de reconnexion EMQX automatique',
        payload: { attempts: this.status.reconnectAttempts },
        severity: Severity.warning,
      });
    });

    this.client.on('close', () => {
      this.status.connected = false;
      gcpLogger({
        fileLink: __filename,
        message: 'Connexion EMQX fermée',
        payload: {
          isSimulationRunning: this.isSimulationRunning,
          willAttemptReconnect: this.isSimulationRunning,
        },
        severity: Severity.warning,
      });

      // Reconnexion automatique si une simulation est en cours
      if (this.isSimulationRunning) {
        this.attemptReconnection();
      }
    });

    this.client.on('offline', () => {
      this.status.connected = false;
      gcpLogger({
        fileLink: __filename,
        message: 'Client EMQX hors ligne',
        payload: { isSimulationRunning: this.isSimulationRunning },
        severity: Severity.warning,
      });

      // Reconnexion automatique si une simulation est en cours
      if (this.isSimulationRunning) {
        this.attemptReconnection();
      }
    });

    // Gestion des erreurs en continu
    this.client.on('error', (error) => {
      gcpLogger({
        fileLink: __filename,
        message: 'Erreur EMQX continue',
        payload: {
          error: error.message,
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
    retries = 3
  ): Promise<void> {
    if (!this.client || !this.status.connected) {
      // Tentative de reconnexion automatique
      if (this.isSimulationRunning && retries > 0) {
        gcpLogger({
          fileLink: __filename,
          message: 'EMQX non connecté, tentative de reconnexion pour publish',
          severity: Severity.warning,
        });

        try {
          await this.connect();
        } catch (connectError) {
          if (retries > 1) {
            // Retry après délai
            await new Promise((resolve) => {
              setTimeout(resolve, 1000);
            });
            return this.publish(topic, message, qos, retries - 1);
          }
          throw new Error(
            `Failed to reconnect for publish: ${connectError.message}`
          );
        }
      } else {
        throw new Error('Client EMQX non connecté');
      }
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
              error: error.message,
              qos: publishQos,
              retries: retries - 1,
              topic,
            },
            severity: Severity.error,
          });

          // Retry en cas d'erreur si des tentatives restent
          if (retries > 1 && this.isSimulationRunning) {
            setTimeout(() => {
              this.publish(topic, message, qos, retries - 1)
                .then(resolve)
                .catch(reject);
            }, 1000);
          } else {
            reject(error);
          }
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
          severity: Severity.info,
        });

        resolve();
      });
    });
  }

  /**
   * Obtient le statut de la connexion
   */
  public getStatus(): EmqxConnectionStatus {
    return {
      ...this.status,
      isSimulationRunning: this.isSimulationRunning,
    };
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
    if (!this.client || !this.status.connected) {
      return false;
    }

    try {
      // Publier un message de test sur un topic spécial
      const testTopic = `$SYS/ping/${this.config.clientId}`;
      const testMessage = JSON.stringify({
        clientId: this.config.clientId,
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
        payload: { error: error.message },
        severity: Severity.warning,
      });
      return false;
    }
  }
}

export default EmqxClientService;
