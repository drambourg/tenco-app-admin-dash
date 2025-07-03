import { EmqxConfig } from './emqx.interface';

/**
 * Configuration EMQX depuis les variables d'environnement
 */
export function getEmqxConfig(): EmqxConfig {
  // Extraction du broker depuis l'URL complète
  let broker = process.env.EMQX_BROKER || process.env.EMQX_HOST || 'localhost';
  let port = parseInt(process.env.EMQX_PORT || '1883', 10);

  // Si EMQX_BROKER contient une URL complète, l'analyser
  if (broker.includes('://')) {
    try {
      const url = new URL(broker);
      broker = url.hostname;
      if (url.port) {
        port = parseInt(url.port, 10);
      }
    } catch (error) {
      console.warn(
        `⚠️  URL EMQX_BROKER invalide: ${broker}, utilisation de localhost`
      );
      broker = 'localhost';
    }
  }

  const config: EmqxConfig = {
    broker,
    clientId:
      process.env.EMQX_CLIENT_ID ||
      `client-${process.env.NODE_ENV}-${Date.now()}`,
    connectTimeout: parseInt(process.env.EMQX_CONNECT_TIMEOUT || '10000', 10),
    keepAlive: parseInt(process.env.EMQX_KEEP_ALIVE || '30', 10),
    password: process.env.EMQX_PASSWORD,
    port,
    qos: parseInt(process.env.EMQX_QOS || '1', 10) as 0 | 1 | 2,
    reconnectPeriod: parseInt(process.env.EMQX_RECONNECT_PERIOD || '5000', 10),
    username: process.env.EMQX_USERNAME,
  };

  // Validation basique
  if (!config.broker || config.broker === 'localhost') {
    console.warn('⚠️  EMQX_BROKER non configuré, utilisation de localhost');
  }

  if (config.port < 1 || config.port > 65535) {
    throw new Error(`Port EMQX invalide: ${config.port}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  if (![0, 1, 2].includes(config.qos!)) {
    throw new Error(`QoS EMQX invalide: ${config.qos}`);
  }

  console.log(`🔧 Configuration EMQX: ${config.broker}:${config.port}`);

  return config;
}

/**
 * Configuration par défaut pour les tests
 */
export const DEFAULT_EMQX_CONFIG: EmqxConfig = {
  broker: 'localhost',
  connectTimeout: 10000,
  keepAlive: 30,
  port: 1883,
  qos: 1,
  reconnectPeriod: 5000,
};

export default { DEFAULT_EMQX_CONFIG, getEmqxConfig };
