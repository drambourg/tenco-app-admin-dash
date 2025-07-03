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

  private constructor(config: EmqxConfig) {
    this.config = {
      connectTimeout: 10000,
      keepAlive: 30,
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
   * Crée les options de connexion MQTT
   */
  private createConnectionOptions(): IClientOptions {
    const options: IClientOptions = {
      clean: true,
      clientId: this.config.clientId || `emqx-client-${Date.now()}`,
      connectTimeout: this.config.connectTimeout,
      keepalive: this.config.keepAlive,
      reconnectPeriod: this.config.reconnectPeriod,
      resubscribe: true,
    };

    // Ajout des credentials si fournis
    if (this.config.username) {
      options.username = this.config.username;
      options.password = this.config.password;
    }

    return options;
  }

  /**
   * Établit la connexion au broker EMQX
   */
  public async connect(): Promise<void> {
    if (this.client && this.status.connected) {
      return;
    }

    if (this.status.connecting) {
      throw new Error('Connexion déjà en cours');
    }

    this.status.connecting = true;

    try {
      // Construction de l'URL broker (sans protocole dans l'URL finale)
      const brokerUrl = `mqtt://${this.config.broker}:${this.config.port}`;
      const options = this.createConnectionOptions();

      gcpLogger({
        fileLink: __filename,
        message: 'Tentative de connexion EMQX',
        payload: {
          broker: this.config.broker,
          brokerUrl,
          clientId: options.clientId,
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
        }, this.config.connectTimeout);

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

      // Configuration des event listeners
      this.setupEventListeners();
    } catch (error) {
      this.status.connecting = false;
      this.status.error = error.message;
      throw error;
    }
  }

  /**
   * Configure les event listeners pour le client MQTT
   */
  private setupEventListeners(): void {
    if (!this.client) return;

    this.client.on('reconnect', () => {
      this.status.reconnectAttempts += 1;
      gcpLogger({
        fileLink: __filename,
        message: 'Tentative de reconnexion EMQX',
        payload: { attempts: this.status.reconnectAttempts },
        severity: Severity.warning,
      });
    });

    this.client.on('close', () => {
      this.status.connected = false;
      gcpLogger({
        fileLink: __filename,
        message: 'Connexion EMQX fermée',
        severity: Severity.warning,
      });
    });

    this.client.on('offline', () => {
      this.status.connected = false;
      gcpLogger({
        fileLink: __filename,
        message: 'Client EMQX hors ligne',
        severity: Severity.warning,
      });
    });
  }

  /**
   * Publie un message sur un topic MQTT
   */
  public async publish(
    topic: string,
    message: string | Buffer,
    qos?: 0 | 1 | 2
  ): Promise<void> {
    if (!this.client || !this.status.connected) {
      throw new Error('Client EMQX non connecté');
    }

    const publishQos = qos ?? this.config.qos ?? 1;

    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.client!.publish(topic, message, { qos: publishQos }, (error) => {
        if (error) {
          gcpLogger({
            fileLink: __filename,
            message: 'Erreur lors de la publication MQTT',
            payload: { error: error.message, qos: publishQos, topic },
            severity: Severity.error,
          });
          reject(error);
        } else {
          gcpLogger({
            fileLink: __filename,
            message: 'Message MQTT publié avec succes',
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
   * Ferme la connexion EMQX
   */
  public async disconnect(): Promise<void> {
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
    return { ...this.status };
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
   * Teste la connexion
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
