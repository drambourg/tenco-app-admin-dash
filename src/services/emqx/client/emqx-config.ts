/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { EmqxConfig } from './emqx.interface';

/**
 * Configuration EMQX optimisée pour EMQX Cloud
 */
export function getEmqxConfig(): EmqxConfig {
  // Configuration spécifique EMQX Cloud
  const broker =
    process.env.EMQX_BROKER || 'b013eb3f.ala.dedicated.gcp.emqxcloud.com';
  const port = parseInt(process.env.EMQX_PORT || '1883', 10);
  const useTls = process.env.EMQX_USE_TLS === 'true';
  const useWebSocket = process.env.EMQX_USE_WEBSOCKET === 'true';

  // Validation spécifique cloud
  if (!broker.includes('emqxcloud.com')) {
    console.warn(
      '⚠️ Le broker ne semble pas être EMQX Cloud. Configuration générique appliquée.'
    );
  }

  // Validation des credentials (obligatoires pour EMQX Cloud)
  if (!process.env.EMQX_USERNAME || !process.env.EMQX_PASSWORD) {
    throw new Error(
      '❌ EMQX_USERNAME et EMQX_PASSWORD sont obligatoires pour EMQX Cloud'
    );
  }

  const config: EmqxConfig = {
    broker,
    // Client ID unique pour éviter les conflits sur infrastructure partagée
    clientId: `tenco-cloud-${process.env.NODE_ENV || 'dev'}-${Date.now()}`,

    // 3 minutes
    // Timeout généreux pour latence réseau cloud
    connectTimeout: parseInt(process.env.EMQX_CONNECT_TIMEOUT || '60000', 10),

    // 🌐 PARAMÈTRES OPTIMISÉS POUR EMQX CLOUD
    // Keep-alive plus long car serveurs cloud sont plus stables
    keepAlive: parseInt(process.env.EMQX_KEEP_ALIVE || '180', 10),

    password: process.env.EMQX_PASSWORD,

    port,

    protocolVersion: parseInt(process.env.EMQX_PROTOCOL_VERSION || '4', 10),

    // 10s
    qos: parseInt(process.env.EMQX_QOS || '1', 10) as 0 | 1 | 2,

    // 60s
    // Reconnexion modérée pour cloud
    reconnectPeriod: parseInt(process.env.EMQX_RECONNECT_PERIOD || '10000', 10),

    // � OPTIONS SPÉCIFIQUES CLOUD
    useTls,

    useWebSocket,
    // �🔑 Credentials obligatoires pour cloud
    username: process.env.EMQX_USERNAME,
  };

  // Validation des ports selon le type de connexion
  if (useTls && !useWebSocket && port !== 8883) {
    console.warn(
      `⚠️ Port ${port} inhabituel pour MQTT over TLS. Port recommandé: 8883`
    );
  }

  if (useWebSocket && !useTls && port !== 8083) {
    console.warn(
      `⚠️ Port ${port} inhabituel pour WebSocket. Port recommandé: 8083`
    );
  }

  if (useWebSocket && useTls && port !== 8084) {
    console.warn(
      `⚠️ Port ${port} inhabituel pour WebSocket over TLS. Port recommandé: 8084`
    );
  }

  // Recommandations de configuration cloud
  if (config.keepAlive! < 120) {
    console.warn(
      `⚠️ Keep-alive de ${config.keepAlive}s peut être trop court pour EMQX Cloud. Recommandé: 180s+`
    );
  }

  if (config.connectTimeout! < 30000) {
    console.warn(
      `⚠️ Connect timeout de ${config.connectTimeout}ms peut être trop court pour EMQX Cloud. Recommandé: 60s+`
    );
  }

  // Log de configuration finale
  console.log('🌐 Configuration EMQX Cloud:');
  console.log(`   📡 Broker: ${config.broker}:${config.port}`);
  console.log(
    `   🔐 Security: ${useTls ? 'TLS' : 'Plain'} ${
      useWebSocket ? '+ WebSocket' : ''
    }`
  );
  console.log(`   ⏱️ Keep-alive: ${config.keepAlive}s (cloud optimized)`);
  console.log(`   🕐 Connect timeout: ${config.connectTimeout}ms`);
  console.log(`   🔄 Reconnect period: ${config.reconnectPeriod}ms`);
  console.log(
    `   👤 Username: ${config.username ? '✅ Configured' : '❌ Missing'}`
  );

  return config;
}

/**
 * Configuration par défaut pour EMQX Cloud
 */
export const EMQX_CLOUD_CONFIG: EmqxConfig = {
  broker: 'b013eb3f.ala.dedicated.gcp.emqxcloud.com',
  // 3 minutes pour cloud
  connectTimeout: 60000,

  keepAlive: 180,
  port: 1883,

  protocolVersion: 4,

  // 10 secondes
  qos: 1,
  // 60 secondes pour latence cloud
  reconnectPeriod: 10000,
  useTls: false,
  useWebSocket: false,
};

export default { EMQX_CLOUD_CONFIG, getEmqxConfig };
