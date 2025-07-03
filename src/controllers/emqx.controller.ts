import { Severity } from '@google-cloud/logging';
import { Request, Response } from 'express';

import EmqxClientService from '../services/emqx/client/emqx-client.service';
import gcpLogger from '../utils/gcp/gcp-logger';

/**
 * Health check du service EMQX
 */
export async function healthEmqx(req: Request, res: Response): Promise<any> {
  try {
    let emqxService;
    try {
      emqxService = EmqxClientService.getInstance();
    } catch (error) {
      return res.status(500).json({
        error: 'EMQX service not initialized',
        success: false,
        timestamp: new Date().toISOString(),
      });
    }

    const status = emqxService.getStatus();
    const config = emqxService.getConfig();

    if (!config.broker || config.broker === 'undefined') {
      return res.status(500).json({
        error: 'EMQX broker not configured',
        success: false,
        timestamp: new Date().toISOString(),
      });
    }

    // Test de ping si connecté
    let pingResult = false;
    if (status.connected) {
      try {
        pingResult = await emqxService.ping();
      } catch (error) {
        // Ping failed but don't crash
        pingResult = false;
      }
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

    res.status(httpStatus).json({
      data: health,
      success: status.connected,
    });
  } catch (error) {
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
  try {
    const emqxService = EmqxClientService.getInstance();
    const initialStatus = emqxService.getStatus();

    // ✅ Phase 1: Déconnexion
    await emqxService.disconnect();

    // ✅ Phase 2: Attendre 2 secondes
    await new Promise((resolve) => {
      setTimeout(resolve, 2000);
    });

    // ✅ Phase 3: Reconnexion
    const startTime = Date.now();
    await emqxService.connect();
    const reconnectDuration = Date.now() - startTime;

    const finalStatus = emqxService.getStatus();

    // ✅ Phase 4: Vérification avec ping
    let pingResult = false;
    if (finalStatus.connected) {
      pingResult = await emqxService.ping();
    }

    const result = {
      finalStatus: {
        connected: finalStatus.connected,
        error: finalStatus.error,
        lastConnected: finalStatus.lastConnected,
        reconnectAttempts: finalStatus.reconnectAttempts,
      },
      initialStatus: {
        connected: initialStatus.connected,
        reconnectAttempts: initialStatus.reconnectAttempts,
      },
      pingResult,
      reconnectDuration,
      success: finalStatus.connected && pingResult,
      timestamp: new Date().toISOString(),
    };

    const statusCode = result.success ? 200 : 500;
    res.status(statusCode).json(result);
  } catch (error) {
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
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 1400px; margin: 0 auto; padding: 20px; background: #f8f9fa; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 2.5rem; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .status { padding: 15px; border-radius: 8px; margin: 15px 0; font-weight: bold; }
        .connected { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .disconnected { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 25px; margin-bottom: 30px; }
        .card { background: white; border: 1px solid #e0e0e0; border-radius: 12px; padding: 25px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .card h3 { margin-top: 0; color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
        button { padding: 12px 20px; margin: 8px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.3s; }
        .btn-primary { background: #667eea; color: white; }
        .btn-primary:hover { background: #5a6fd8; transform: translateY(-2px); }
        .btn-success { background: #28a745; color: white; }
        .btn-success:hover { background: #218838; transform: translateY(-2px); }
        .btn-danger { background: #dc3545; color: white; }
        .btn-danger:hover { background: #c82333; transform: translateY(-2px); }
        .btn-warning { background: #ffc107; color: #212529; }
        .btn-warning:hover { background: #e0a800; transform: translateY(-2px); }
        .logs { background: #2d3748; color: #e2e8f0; border: 1px solid #4a5568; border-radius: 6px; padding: 20px; height: 350px; overflow-y: auto; font-family: 'Courier New', monospace; font-size: 14px; resize: none; width: 100%; box-sizing: border-box; }
          input, textarea, select { width: 100%; padding: 10px; margin: 8px 0; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; }
        .route-section { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .route-section h4 { color: #856404; margin-top: 0; }
        .route-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; }
        .route-item { background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #667eea; }
        .route-item strong { color: #667eea; }
        .simulator-status { padding: 10px; border-radius: 6px; margin: 10px 0; text-align: center; font-weight: bold; }
        .simulator-running { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
        .simulator-stopped { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .timeline-info { background: #e2e3e5; border: 1px solid #d6d8db; border-radius: 6px; padding: 15px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔌 EMQX Service Manager</h1>
        <p>Gestion du broker MQTT et simulateur IoT</p>
    </div>
    
    <div id="status" class="status disconnected">
        Chargement du statut EMQX...
    </div>

    <div class="grid">
        <!-- Statut EMQX -->
        <div class="card">
            <h3>📊 Statut EMQX</h3>
            <div id="stats">Chargement...</div>
            <button class="btn-primary" onclick="refreshStats()">🔄 Actualiser</button>
            <button class="btn-primary" onclick="testReconnect()">🔄 Test Reconnexion</button>
        </div>

        <!-- Test Publication -->
        <div class="card">
            <h3>🧪 Test Publication MQTT</h3>
            <input type="text" id="topic" placeholder="Topic MQTT" value="data">
            <textarea id="message" placeholder="Message JSON" rows="4">{"mac": "00:11:22:33:44:55", "time": ${Date.now()}, "test": true}</textarea>
            <select id="qos">
                <option value="0">QoS 0 (At most once)</option>
                <option value="1" selected>QoS 1 (At least once)</option>
                <option value="2">QoS 2 (Exactly once)</option>
            </select>
            <button class="btn-success" onclick="testPublish()">📡 Publier Message</button>
        </div>

        <!-- Simulateur IoT -->
        <div class="card">
            <h3>🤖 Simulateur IoT EMQX</h3>
            <div id="simulatorStatus" class="simulator-status simulator-stopped">
                ⏸️ Simulateur arrêté
            </div>
            <div id="timelineInfo" class="timeline-info">
                Chargement des informations...
            </div>
            <input type="number" id="durationMinutes" placeholder="Durée (minutes)" value="1" min="1" max="60">
                <input type="text" id="macAddresses" placeholder="MAC Addresses (ex: 9999,33333,12222)" value="00:11:22:33:44:55,00:11:22:33:44:56,00:11:22:33:44:57">

                <div style="margin: 10px 0;">
                <label>
                    <input type="checkbox" id="debugMode" style="width: auto; margin-right: 8px;">
                    Mode Debug (affichage uniquement, pas d'envoi MQTT)
                </label>
            </div>
            <button class="btn-success" onclick="startSimulator()">▶️ Démarrer</button>
            <button class="btn-danger" onclick="stopSimulator()">⏹️ Arrêter</button>
            <button class="btn-warning" onclick="testSingleMessage()">📨 Test Simple</button>
            <button class="btn-primary" onclick="refreshSimulatorStatus()">🔄 Status</button>
        </div>

        <!-- Contrôles Avancés -->
        <div class="card">
            <h3>🔧 Contrôles Avancés</h3>
            <button class="btn-primary" onclick="getMacAddresses()">📋 MAC Addresses</button>
            <button class="btn-primary" onclick="getTimelineInfo()">⏰ Timeline Info</button>
            <button class="btn-warning" onclick="resetTimeline()">🔄 Reset Timeline</button>
            <button class="btn-danger" onclick="clearLogs()">🧹 Vider Logs</button>
        </div>
    </div>

    <!-- Documentation des Routes -->
    <div class="route-section">
        <h4>📚 Routes API Disponibles</h4>
        <div class="route-list">
            <div class="route-item">
                <strong>GET /emqx-iot-simulator/health</strong><br>
                Vérification de l'état du simulateur
            </div>
            <div class="route-item">
                <strong>POST /emqx-iot-simulator/start</strong><br>
                Démarrer la simulation IoT
            </div>
            <div class="route-item">
                <strong>POST /emqx-iot-simulator/stop</strong><br>
                Arrêter la simulation en cours
            </div>
            <div class="route-item">
                <strong>GET /emqx-iot-simulator/status</strong><br>
                Statut détaillé de la simulation
            </div>
            <div class="route-item">
                <strong>POST /emqx-iot-simulator/test</strong><br>
                Publier un message de test
            </div>
            <div class="route-item">
                <strong>GET /emqx-iot-simulator/mac-addresses</strong><br>
                Liste des adresses MAC disponibles
            </div>
            <div class="route-item">
                <strong>GET /emqx-iot-simulator/timeline-info</strong><br>
                Informations sur la timeline synchronisée
            </div>
            <div class="route-item">
                <strong>POST /emqx-iot-simulator/reset-timeline</strong><br>
                Réinitialiser la timeline globale
            </div>
        </div>
    </div>

    <!-- Logs -->
    <div class="card">
        <h3>📋 Logs en Temps Réel</h3>
        <textarea id="logs" class="logs" readonly></textarea>
    </div>

    <script>
        function addLog(message, type = 'info') {
          const logs = document.getElementById('logs');
          const timestamp = new Date().toLocaleTimeString();
          const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
          logs.value += \`[\${timestamp}] \${icon} \${message}\\n\`;
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
                    statusDiv.textContent = \`✅ EMQX connecté à \${result.data.config.broker}:\${result.data.config.port}\`;
                    
                    statsDiv.innerHTML = \`
                        <p><strong>Broker:</strong> \${result.data.config.broker}:\${result.data.config.port}</p>
                        <p><strong>Client ID:</strong> \${result.data.config.clientId}</p>
                        <p><strong>QoS par défaut:</strong> \${result.data.config.qos}</p>
                        <p><strong>Authentification:</strong> \${result.data.config.hasCredentials ? '🔐 Oui' : '🔓 Non'}</p>
                        <p><strong>Dernière connexion:</strong> \${new Date(result.data.lastConnected).toLocaleString()}</p>
                        <p><strong>Tentatives reconnexion:</strong> \${result.data.reconnectAttempts}</p>
                        <p><strong>Test Ping:</strong> \${result.data.ping ? '✅ OK' : '❌ Échec'}</p>
                    \`;
                    
                    addLog('Statut EMQX actualisé - Service connecté', 'success');
                } else {
                    statusDiv.className = 'status disconnected';
                    statusDiv.textContent = \`❌ EMQX déconnecté: \${result.data?.error || 'Erreur inconnue'}\`;
                    statsDiv.innerHTML = '<p>Service EMQX non disponible</p>';
                    addLog(\`Service EMQX déconnecté: \${result.data?.error || 'Erreur inconnue'}\`, 'error');
                }
            } catch (error) {
                addLog(\`Erreur lors de la vérification EMQX: \${error.message}\`, 'error');
            }
        }

        async function refreshSimulatorStatus() {
            try {
                const response = await fetch('/emqx-iot-simulator/status');
                const result = await response.json();
                
                const statusDiv = document.getElementById('simulatorStatus');
                const timelineDiv = document.getElementById('timelineInfo');
                
                if (result.success) {
                    if (result.status.isRunning) {
                        statusDiv.className = 'simulator-status simulator-running';
                        statusDiv.innerHTML = \`
                            ▶️ Simulation active<br>
                            <small>Capteurs: \${result.status.totalSensors} | Messages: \${result.status.messagesSent} | Erreurs: \${result.status.errors}</small>
                        \`;
                    } else {
                        statusDiv.className = 'simulator-status simulator-stopped';
                        statusDiv.innerHTML = '⏸️ Simulateur arrêté';
                    }
                    
                    timelineDiv.innerHTML = \`
                        <strong>Timeline:</strong> \${result.timeline.isTimelineActive ? '🟢 Active' : '🔴 Inactive'}<br>
                        <small>Start: \${result.timeline.globalStartTime ? new Date(result.timeline.globalStartTime).toLocaleString() : 'Non défini'}</small>
                    \`;
                    
                    addLog('Statut simulateur actualisé', 'success');
                } else {
                    addLog(\`Erreur statut simulateur: \${result.error}\`, 'error');
                }
            } catch (error) {
                addLog(\`Erreur lors de la vérification du simulateur: \${error.message}\`, 'error');
            }
        }

        async function startSimulator() {
            try {
                const duration = document.getElementById('durationMinutes').value;
                 const debugMode = document.getElementById('debugMode').checked;
                const macAddressesInput = document.getElementById('macAddresses').value;
                  const macAddresses = macAddressesInput
                    .split(',')
                    .map(mac => mac.trim())
                    .filter(mac => mac.length > 0);
                
                if (macAddresses.length === 0) {
                    addLog('Veuillez saisir au moins une adresse MAC', 'error');
                    return;
                }
                
                addLog(\`Démarrage du simulateur pour \${duration} minute(s)...\`, 'info');
                addLog(\`MAC Addresses: \${macAddresses.join(', ')}\`, 'info');
                const response = await fetch('/emqx-iot-simulator/start', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        durationMinutes: parseInt(duration),
                        centerLat: 48.8566,
                        centerLng: 2.3522,
                        boundingBoxKm: 0.2,
                        macAddresses: macAddresses,
                        debugMode: debugMode
                    })
                });

                const result = await response.json();
                
                if (result.success) {
                    addLog(\`Simulateur démarré avec succès (\${result.status.totalSensors} capteurs)\`, 'success');
                    refreshSimulatorStatus();
                } else {
                    addLog(\`Échec du démarrage: \${result.error}\`, 'error');
                }
            } catch (error) {
                addLog(\`Erreur: \${error.message}\`, 'error');
            }
        }

        async function stopSimulator() {
            try {
                addLog('Arrêt du simulateur...', 'info');
                
                const response = await fetch('/emqx-iot-simulator/stop', {
                    method: 'POST'
                });

                const result = await response.json();
                
                if (result.success) {
                    addLog('Simulateur arrêté avec succès', 'success');
                    refreshSimulatorStatus();
                } else {
                    addLog(\`Échec de l'arrêt: \${result.error}\`, 'error');
                }
            } catch (error) {
                addLog(\`Erreur: \${error.message}\`, 'error');
            }
        }

        async function testSingleMessage() {
            try {
                addLog('Envoi d\\'un message de test...', 'info');
                
                const response = await fetch('/emqx-iot-simulator/test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        macAddresses: ['00:11:22:33:44:55'],
                        centerLat: 48.8566,
                        centerLng: 2.3522,
                        boundingBoxKm: 0.2
                    })
                });

                const result = await response.json();
                
                if (result.success) {
                    addLog(\`Message de test publié (MAC: \${result.data.mac})\`, 'success');
                } else {
                    addLog(\`Échec du test: \${result.error}\`, 'error');
                }
            } catch (error) {
                addLog(\`Erreur: \${error.message}\`, 'error');
            }
        }

        async function testPublish() {
            try {
                const topic = document.getElementById('topic').value;
                const message = document.getElementById('message').value;
                const qos = parseInt(document.getElementById('qos').value);
                
                if (!topic || !message) {
                    addLog('Topic et message requis', 'warning');
                    return;
                }

                const response = await fetch('/emqx/test/publish', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ topic, message, qos })
                });

                const result = await response.json();
                
                if (result.success) {
                    addLog(\`Message publié sur \${result.topic} (QoS \${result.qos}, \${result.duration}ms)\`, 'success');
                } else {
                    addLog(\`Échec publication: \${result.error}\`, 'error');
                }
            } catch (error) {
                addLog(\`Erreur: \${error.message}\`, 'error');
            }
        }

        async function testReconnect() {
            try {
                addLog('Test de reconnexion EMQX...', 'info');
                
                const response = await fetch('/emqx/test/reconnect', {
                    method: 'POST'
                });

                const result = await response.json();
                
                if (result.success) {
                    addLog(\`Reconnexion EMQX réussie (\${result.reconnectDuration}ms)\`, 'success');
                    refreshStats();
                } else {
                    addLog(\`Échec reconnexion EMQX: \${result.error}\`, 'error');
                }
            } catch (error) {
                addLog(\`Erreur: \${error.message}\`, 'error');
            }
        }


        async function getTimelineInfo() {
            try {
                const response = await fetch('/emqx-iot-simulator/timeline-info');
                const result = await response.json();
                
                if (result.success) {
                    const timeline = result.timeline;
                    addLog(\`Timeline - Active: \${timeline.isTimelineActive}, Start: \${timeline.globalStartTime ? new Date(timeline.globalStartTime).toLocaleString() : 'Non défini'}\`, 'info');
                } else {
                    addLog(\`Erreur timeline: \${result.error}\`, 'error');
                }
            } catch (error) {
                addLog(\`Erreur: \${error.message}\`, 'error');
            }
        }

        async function resetTimeline() {
            try {
                addLog('Réinitialisation de la timeline...', 'warning');
                
                const response = await fetch('/emqx-iot-simulator/reset-timeline', {
                    method: 'POST'
                });

                const result = await response.json();
                
                if (result.success) {
                    addLog('Timeline réinitialisée avec succès', 'success');
                    refreshSimulatorStatus();
                } else {
                    addLog(\`Échec reset timeline: \${result.error}\`, 'error');
                }
            } catch (error) {
                addLog(\`Erreur: \${error.message}\`, 'error');
            }
        }

        function clearLogs() {
          document.getElementById('logs').value = '';
          addLog('Logs vidés', 'info');
      }

        // Initialisation
        document.addEventListener('DOMContentLoaded', () => {
            addLog('Interface EMQX chargée', 'success');
            refreshStats();
            refreshSimulatorStatus();
            
            // Auto-refresh toutes les 30 secondes
            setInterval(() => {
                refreshStats();
                refreshSimulatorStatus();
            }, 30000);
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
