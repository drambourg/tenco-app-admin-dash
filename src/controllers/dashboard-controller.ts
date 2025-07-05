/* eslint-disable class-methods-use-this */
// src/controllers/dashboard.controller.ts

import { Severity } from '@google-cloud/logging';
import { Request, Response } from 'express';

import gcpLogger from '../utils/gcp/gcp-logger';

export class DashboardController {
  /**
   * Serve dashboard home page with Bull Board integration
   */
  public serveHomePage = async (req: Request, res: Response): Promise<void> => {
    const functionName = 'serveHomePage';

    try {
      res.setHeader('Content-Type', 'text/html');
      res.send(this.getDashboardHTML());

      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: 'Dashboard home page served',
        payload: { userAgent: req.get('User-Agent') },
        severity: Severity.info,
      });
    } catch (error) {
      gcpLogger({
        fileLink: `${__filename}:${functionName}`,
        message: 'Error serving dashboard',
        payload: { error: error.message },
        severity: Severity.error,
      });

      res.status(500).send('Error loading dashboard');
    }
  };

  /**
   * Enhanced dashboard HTML with Bull Board card
   */
  private getDashboardHTML(): string {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tenco Admin Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }

        .header {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            padding: 2rem 0;
            text-align: center;
            color: white;
            margin-bottom: 3rem;
        }

        .header h1 {
            font-size: 2.5rem;
            font-weight: 300;
            margin-bottom: 0.5rem;
        }

        .header p {
            font-size: 1.1rem;
            opacity: 0.9;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 2rem;
        }

        .cards-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 2rem;
            margin-bottom: 3rem;
        }

        .card {
            background: white;
            border-radius: 16px;
            padding: 2.5rem;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
            text-decoration: none;
            color: inherit;
            position: relative;
            overflow: hidden;
        }

        .card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #667eea, #764ba2);
        }

        .card:hover {
            transform: translateY(-8px);
            box-shadow: 0 30px 60px rgba(0, 0, 0, 0.15);
        }

        .card-icon {
            font-size: 3rem;
            margin-bottom: 1.5rem;
            display: block;
        }

        .card-title {
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 1rem;
            color: #2d3748;
        }

        .card-description {
            color: #718096;
            line-height: 1.6;
            margin-bottom: 1.5rem;
        }

        .card-features {
            list-style: none;
            margin-bottom: 2rem;
        }

        .card-features li {
            padding: 0.5rem 0;
            color: #4a5568;
            position: relative;
            padding-left: 1.5rem;
        }

        .card-features li::before {
            content: '✓';
            position: absolute;
            left: 0;
            color: #48bb78;
            font-weight: bold;
        }

        .card-button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 1rem 2rem;
            border-radius: 8px;
            font-weight: 600;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
            width: 100%;
        }

        .card-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
        }

        .status-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 0.5rem;
        }

        .status-online {
            background: #48bb78;
            animation: pulse 2s infinite;
        }

        .status-offline {
            background: #f56565;
        }

        .status-warning {
            background: #ed8936;
        }

        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }

        .footer {
            text-align: center;
            color: rgba(255, 255, 255, 0.8);
            padding: 2rem 0;
            margin-top: 3rem;
        }

        .footer a {
            color: rgba(255, 255, 255, 0.9);
            text-decoration: none;
        }

        .footer a:hover {
            text-decoration: underline;
        }

        @media (max-width: 768px) {
            .header h1 {
                font-size: 2rem;
            }
            
            .cards-grid {
                grid-template-columns: 1fr;
                gap: 1.5rem;
            }
            
            .card {
                padding: 2rem;
            }
            
            .container {
                padding: 0 1rem;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="container">
            <h1>🚀 Tenco Admin Dashboard</h1>
            <p>Plateforme d'administration et d'outils de développement</p>
        </div>
    </div>

    <div class="container">
        <div class="cards-grid">
            <!-- Redis Commander Card -->
            <a href="/redis-commander" class="card">
                <div class="card-icon">🗃️</div>
                <h2 class="card-title">
                    <span class="status-indicator status-online"></span>
                    Redis Commander
                </h2>
                <p class="card-description">
                    Interface de gestion complète pour votre base de données Redis. 
                    Visualisez, modifiez et gérez vos données en temps réel.
                </p>
                <ul class="card-features">
                    <li>Navigation par base de données</li>
                    <li>Visualisation des clés et valeurs</li>
                    <li>Support de tous les types Redis</li>
                    <li>Statistiques en temps réel</li>
                    <li>Suppression sécurisée</li>
                </ul>
                <button class="card-button">
                    Accéder à Redis Commander →
                </button>
            </a>

            <!-- Bull Board Card -->
            <a href="/bull-board" class="card">
                <div class="card-icon">📊</div>
                <h2 class="card-title">
                    <span class="status-indicator status-online"></span>
                    Bull Board
                </h2>
                <p class="card-description">
                    Surveillance et gestion des jobs de traitement des données. 
                    Monitorez la queue process-datapoint-queue en temps réel.
                </p>
                <ul class="card-features">
                    <li>États des jobs (waiting, active, completed)</li>
                    <li>Retry et nettoyage des jobs</li>
                    <li>Statistiques détaillées</li>
                    <li>Logs et erreurs</li>
                    <li>Contrôle des queues</li>
                </ul>
                <button class="card-button">
                    Surveiller les jobs →
                </button>
            </a>

             <!-- EMQX IoT Simulator Card -->
            <a href="/emqx-iot-simulator" class="card">
                <div class="card-icon">🔌</div>
                <h2 class="card-title">
                    <span class="status-indicator status-online"></span>
                    EMQX IoT Simulator
                </h2>
                <p class="card-description">
                    Simulateur IoT spécialisé pour EMQX MQTT. 
                    Génère des données de capteurs synchronisées avec timeline continue.
                </p>
                <ul class="card-features">
                    <li>Publication MQTT vers EMQX</li>
                    <li>Timeline synchronisée</li>
                    <li>Données X,Y vibrations</li>
                    <li>Géolocalisation aléatoire</li>
                    <li>Cloud Scheduler compatible</li>
                </ul>
                <button class="card-button">
                    Accéder au simulateur EMQX →
                </button>
            </a>

        </div>
    </div>

    <div class="footer">
        <div class="container">
            <p>
                Tenco Admin Dashboard v1.0 | 
                <a href="/iot-simulator/health">IoT Status</a> | 
                <a href="/emqx-iot-simulator/health">EMQX IoT Status</a> | 
                <a href="/redis-commander/health">Redis Health</a> |
                <a href="/bull-board-health">Jobs Health</a>
            </p>
        </div>
    </div>

    <script>
        // Enhanced status check including Bull Board and EMQX IoT Simulator
        async function checkServices() {
            // Check Redis Commander
            try {
                const redisResponse = await fetch('/redis-commander/health');
                const redisStatus = document.querySelector('.card[href="/redis-commander"] .status-indicator');
                if (redisResponse.ok) {
                    redisStatus.className = 'status-indicator status-online';
                } else {
                    redisStatus.className = 'status-indicator status-offline';
                }
            } catch (error) {
                const redisStatus = document.querySelector('.card[href="/redis-commander"] .status-indicator');
                redisStatus.className = 'status-indicator status-offline';
            }

            // Check Bull Board
            try {
                const bullResponse = await fetch('/bull-board-health');
                const bullStatus = document.querySelector('.card[href="/bull-board"] .status-indicator');
                if (bullResponse.ok) {
                    const data = await bullResponse.json();
                    if (data.success) {
                        bullStatus.className = 'status-indicator status-online';
                    } else {
                        bullStatus.className = 'status-indicator status-warning';
                    }
                } else {
                    bullStatus.className = 'status-indicator status-offline';
                }
            } catch (error) {
                const bullStatus = document.querySelector('.card[href="/bull-board"] .status-indicator');
                bullStatus.className = 'status-indicator status-offline';
            }

            // Check IoT Simulator
            try {
                const iotResponse = await fetch('/iot-simulator/health');
                const iotStatus = document.querySelector('.card[href="/iot-simulator"] .status-indicator');
                if (iotResponse.ok) {
                    iotStatus.className = 'status-indicator status-online';
                } else {
                    iotStatus.className = 'status-indicator status-offline';
                }
            } catch (error) {
                const iotStatus = document.querySelector('.card[href="/iot-simulator"] .status-indicator');
                iotStatus.className = 'status-indicator status-offline';
            }

            // Check EMQX IoT Simulator
            try {
                const emqxIotResponse = await fetch('/emqx-iot-simulator/health');
                const emqxIotStatus = document.querySelector('.card[href="/emqx-iot-simulator"] .status-indicator');
                if (emqxIotResponse.ok) {
                    const data = await emqxIotResponse.json();
                    if (data.success) {
                        emqxIotStatus.className = 'status-indicator status-online';
                    } else {
                        emqxIotStatus.className = 'status-indicator status-warning';
                    }
                } else {
                    emqxIotStatus.className = 'status-indicator status-offline';
                }
            } catch (error) {
                const emqxIotStatus = document.querySelector('.card[href="/emqx-iot-simulator"] .status-indicator');
                emqxIotStatus.className = 'status-indicator status-offline';
            }
        }

        // Check status on load
        document.addEventListener('DOMContentLoaded', checkServices);
        
        // Refresh status every 30 seconds
        setInterval(checkServices, 30000);
    </script>
</body>
</html>`;
  }
}

// Export singleton
const dashboardController = new DashboardController();
export const { serveHomePage } = dashboardController;
