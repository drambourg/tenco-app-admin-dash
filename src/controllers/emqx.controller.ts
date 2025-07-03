import { Severity } from '@google-cloud/logging';
import { Request, Response } from 'express';

import EmqxClientService from '../services/emqx/emqx-client.service';
import gcpLogger from '../utils/gcp/gcp-logger';

/**
 * Health check du service EMQX
 */
export async function healthEmqx(req: Request, res: Response): Promise<void> {
  const functionName = 'healthEmqx';

  try {
    const emqxService = EmqxClientService.getInstance();
    const status = emqxService.getStatus();
    const config = emqxService.getConfig();

    // Test de ping si connecté
    let pingResult = false;
    if (status.connected) {
      pingResult = await emqxService.ping();
    }

    const health = {
      config: {
        broker: config.broker,
        clientId: config.clientId,
        hasCredentials: !!config.username,
        port: config.port,
        qos: config.qos,
      },
      connected: status.connected,
      connecting: status.connecting,
      error: status.error,
      lastConnected: status.lastConnected,
      ping: pingResult,
      reconnectAttempts: status.reconnectAttempts,
      service: 'emqx',
      status: status.connected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    };

    const httpStatus = status.connected ? 200 : 503;

    gcpLogger({
      fileLink: `${__filename}:${functionName}`,
      message: 'EMQX health check performed',
      payload: health,
      severity: status.connected ? Severity.info : Severity.warning,
    });

    res.status(httpStatus).json({
      data: health,
      success: status.connected,
    });
  } catch (error) {
    gcpLogger({
      fileLink: `${__filename}:${functionName}`,
      message: 'Error during EMQX health check',
      payload: { error: error.message },
      severity: Severity.error,
    });

    res.status(500).json({
      error: error.message,
      success: false,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Test de publication d'un message MQTT
 */
export async function testPublish(req: Request, res: Response): Promise<any> {
  const functionName = 'testPublish';

  try {
    const { message, qos, topic } = req.body;

    if (!topic || !message) {
      return res.status(400).json({
        error: 'Topic et message requis',
        success: false,
        timestamp: new Date().toISOString(),
      });
    }

    const emqxService = EmqxClientService.getInstance();
    const status = emqxService.getStatus();

    if (!status.connected) {
      return res.status(503).json({
        error: 'Service EMQX non connecté',
        status,
        success: false,
        timestamp: new Date().toISOString(),
      });
    }

    const testMessage =
      typeof message === 'string' ? message : JSON.stringify(message);
    const startTime = Date.now();

    await emqxService.publish(topic, testMessage, qos);

    const duration = Date.now() - startTime;

    const result = {
      duration,
      messageLength: testMessage.length,
      qos: qos || emqxService.getConfig().qos,
      success: true,
      timestamp: new Date().toISOString(),
      topic,
    };

    gcpLogger({
      fileLink: `${__filename}:${functionName}`,
      message: 'Test MQTT publish successful',
      payload: result,
      severity: Severity.info,
    });

    res.status(200).json(result);
  } catch (error) {
    gcpLogger({
      fileLink: `${__filename}:${functionName}`,
      message: 'Error during MQTT publish test',
      payload: {
        body: req.body,
        error: error.message,
      },
      severity: Severity.error,
    });

    res.status(500).json({
      error: error.message,
      success: false,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Test de reconnexion EMQX
 */
export async function testReconnect(
  req: Request,
  res: Response
): Promise<void> {
  const functionName = 'testReconnect';

  try {
    const emqxService = EmqxClientService.getInstance();
    const initialStatus = emqxService.getStatus();

    gcpLogger({
      fileLink: `${__filename}:${functionName}`,
      message: 'Starting EMQX reconnection test',
      payload: { initialStatus },
      severity: Severity.info,
    });

    // Déconnexion
    await emqxService.disconnect();

    // Attendre un peu
    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });

    // Reconnexion
    const startTime = Date.now();
    await emqxService.connect();
    const reconnectDuration = Date.now() - startTime;

    const finalStatus = emqxService.getStatus();

    const result = {
      finalStatus: {
        connected: finalStatus.connected,
        lastConnected: finalStatus.lastConnected,
        reconnectAttempts: finalStatus.reconnectAttempts,
      },
      initialStatus: {
        connected: initialStatus.connected,
        reconnectAttempts: initialStatus.reconnectAttempts,
      },
      reconnectDuration,
      success: true,
      timestamp: new Date().toISOString(),
    };

    gcpLogger({
      fileLink: `${__filename}:${functionName}`,
      message: 'EMQX reconnection test completed',
      payload: result,
      severity: Severity.info,
    });

    res.status(200).json(result);
  } catch (error) {
    gcpLogger({
      fileLink: `${__filename}:${functionName}`,
      message: 'Error during EMQX reconnection test',
      payload: { error: error.message },
      severity: Severity.error,
    });

    res.status(500).json({
      error: error.message,
      success: false,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Obtenir les statistiques EMQX
 */
export async function getEmqxStats(req: Request, res: Response): Promise<void> {
  const functionName = 'getEmqxStats';

  try {
    const emqxService = EmqxClientService.getInstance();
    const status = emqxService.getStatus();
    const config = emqxService.getConfig();

    // Test de performance
    let pingDuration = null;
    if (status.connected) {
      const pingStart = Date.now();
      const pingResult = await emqxService.ping();
      pingDuration = pingResult ? Date.now() - pingStart : null;
    }

    const stats = {
      configuration: {
        broker: config.broker,
        clientId: config.clientId,
        connectTimeout: config.connectTimeout,
        hasCredentials: !!config.username,
        keepAlive: config.keepAlive,
        port: config.port,
        qos: config.qos,
        reconnectPeriod: config.reconnectPeriod,
      },
      connection: {
        connected: status.connected,
        connecting: status.connecting,
        error: status.error,
        lastConnected: status.lastConnected,
        reconnectAttempts: status.reconnectAttempts,
      },
      performance: {
        pingDuration,
        uptime: status.lastConnected
          ? Date.now() - new Date(status.lastConnected).getTime()
          : null,
      },
      timestamp: new Date().toISOString(),
    };

    gcpLogger({
      fileLink: `${__filename}:${functionName}`,
      message: 'EMQX statistics retrieved',
      payload: { connected: status.connected, pingDuration },
      severity: Severity.info,
    });

    res.status(200).json({
      data: stats,
      success: true,
    });
  } catch (error) {
    gcpLogger({
      fileLink: `${__filename}:${functionName}`,
      message: 'Error retrieving EMQX statistics',
      payload: { error: error.message },
      severity: Severity.error,
    });

    res.status(500).json({
      error: error.message,
      success: false,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Interface web pour tester EMQX
 */
export async function serveEmqxInterface(
  req: Request,
  res: Response
): Promise<void> {
  const functionName = 'serveEmqxInterface';

  try {
    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EMQX Service Manager</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
        .status { padding: 10px; border-radius: 5px; margin: 10px 0; }
        .connected { background: #d4edda; color: #155724; }
        .disconnected { background: #f8d7da; color: #721c24; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; }
        button { padding: 10px 15px; margin: 5px; border: none; border-radius: 4px; cursor: pointer; }
        .btn-primary { background: #007bff; color: white; }
        .btn-danger { background: #dc3545; color: white; }
        .btn-success { background: #28a745; color: white; }
        .logs { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 15px; height: 300px; overflow-y: auto; font-family: monospace; }
        input, textarea { width: 100%; padding: 8px; margin: 5px 0; border: 1px solid #ddd; border-radius: 4px; }
    </style>
</head>
<body>
    <h1>🔌 EMQX Service Manager</h1>
    
    <div id="status" class="status disconnected">
        Chargement du statut...
    </div>

    <div class="grid">
        <div class="card">
            <h3>📊 Statistiques</h3>
            <div id="stats">Chargement...</div>
            <button class="btn-primary" onclick="refreshStats()">🔄 Actualiser</button>
        </div>

        <div class="card">
            <h3>🧪 Test de publication</h3>
            <input type="text" id="topic" placeholder="Topic (ex: test/topic)" value="test/emqx">
            <textarea id="message" placeholder="Message JSON" rows="3">{"test": true, "timestamp": ${Date.now()}}</textarea>
            <select id="qos">
                <option value="0">QoS 0</option>
                <option value="1" selected>QoS 1</option>
                <option value="2">QoS 2</option>
            </select>
            <br>
            <button class="btn-success" onclick="testPublish()">📡 Publier</button>
        </div>

        <div class="card">
            <h3>🔧 Actions</h3>
            <button class="btn-primary" onclick="testReconnect()">🔄 Test Reconnexion</button>
            <button class="btn-danger" onclick="clearLogs()">🧹 Vider Logs</button>
        </div>
    </div>

    <div class="card">
        <h3>📋 Logs</h3>
        <div id="logs" class="logs"></div>
    </div>

    <script>
        function addLog(message) {
            const logs = document.getElementById('logs');
            const timestamp = new Date().toLocaleTimeString();
            logs.innerHTML += \`[\${timestamp}] \${message}\\n\`;
            logs.scrollTop = logs.scrollHeight;
        }

        async function refreshStats() {
            try {
                const response = await fetch('/emqx/health');
                const result = await response.json();
                
                const statusDiv = document.getElementById('status');
                const statsDiv = document.getElementById('stats');
                
                if (result.success) {
                    statusDiv.className = 'status connected';
                    statusDiv.textContent = \`✅ Connecté à \${result.data.config.broker}:\${result.data.config.port}\`;
                    
                    statsDiv.innerHTML = \`
                        <p><strong>Client ID:</strong> \${result.data.config.clientId}</p>
                        <p><strong>QoS:</strong> \${result.data.config.qos}</p>
                        <p><strong>Dernière connexion:</strong> \${new Date(result.data.lastConnected).toLocaleString()}</p>
                        <p><strong>Tentatives de reconnexion:</strong> \${result.data.reconnectAttempts}</p>
                        <p><strong>Ping:</strong> \${result.data.ping ? '✅' : '❌'}</p>
                    \`;
                    
                    addLog('✅ Statut actualisé - Service connecté');
                } else {
                    statusDiv.className = 'status disconnected';
                    statusDiv.textContent = \`❌ Déconnecté: \${result.data?.error || 'Erreur inconnue'}\`;
                    statsDiv.innerHTML = '<p>Service non disponible</p>';
                    addLog(\`❌ Service déconnecté: \${result.data?.error || 'Erreur inconnue'}\`);
                }
            } catch (error) {
                addLog(\`❌ Erreur: \${error.message}\`);
            }
        }

        async function testPublish() {
            try {
                const topic = document.getElementById('topic').value;
                const message = document.getElementById('message').value;
                const qos = parseInt(document.getElementById('qos').value);
                
                if (!topic || !message) {
                    addLog('❌ Topic et message requis');
                    return;
                }

                const response = await fetch('/emqx/test/publish', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ topic, message, qos })
                });

                const result = await response.json();
                
                if (result.success) {
                    addLog(\`✅ Message publié sur \${result.topic} (QoS \${result.qos}, \${result.duration}ms)\`);
                } else {
                    addLog(\`❌ Échec publication: \${result.error}\`);
                }
            } catch (error) {
                addLog(\`❌ Erreur: \${error.message}\`);
            }
        }

        async function testReconnect() {
            try {
                addLog('🔄 Test de reconnexion en cours...');
                
                const response = await fetch('/emqx/test/reconnect', {
                    method: 'POST'
                });

                const result = await response.json();
                
                if (result.success) {
                    addLog(\`✅ Reconnexion réussie (\${result.reconnectDuration}ms)\`);
                    refreshStats();
                } else {
                    addLog(\`❌ Échec reconnexion: \${result.error}\`);
                }
            } catch (error) {
                addLog(\`❌ Erreur: \${error.message}\`);
            }
        }

        function clearLogs() {
            document.getElementById('logs').innerHTML = '';
            addLog('🧹 Logs vidés');
        }

        // Initialisation
        document.addEventListener('DOMContentLoaded', () => {
            addLog('🎉 Interface EMQX chargée');
            refreshStats();
            
            // Auto-refresh toutes les 30 secondes
            setInterval(refreshStats, 30000);
        });
    </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);

    gcpLogger({
      fileLink: `${__filename}:${functionName}`,
      message: 'EMQX interface served',
      payload: { userAgent: req.get('User-Agent') },
      severity: Severity.info,
    });
  } catch (error) {
    gcpLogger({
      fileLink: `${__filename}:${functionName}`,
      message: 'Error serving EMQX interface',
      payload: { error: error.message },
      severity: Severity.error,
    });

    res.status(500).send("Erreur lors du chargement de l'interface EMQX");
  }
}
