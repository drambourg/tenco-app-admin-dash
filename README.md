# 🚀 IoT Sensor Simulator

A powerful Node.js/TypeScript application that simulates moving IoT sensors sending realistic data to your Cloud Run endpoints. Perfect for testing, development, and load testing of IoT data processing systems.

## 📋 Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [API Endpoints](#-api-endpoints)
- [Usage Examples](#-usage-examples)
- [Deployment](#-deployment)
- [Data Format](#-data-format)
- [Troubleshooting](#-troubleshooting)

## ✨ Features

- 🌍 **Realistic GPS Movement**: Sensors move at ~5 km/h with intelligent boundary handling
- 📡 **Multi-Endpoint Support**: Send data to multiple Cloud Run endpoints simultaneously
- 🎯 **Custom MAC Addresses**: Define specific MAC addresses for your sensors
- ⏱️ **Timer-Based Control**: Set simulation duration in minutes
- 📊 **Configurable Data Ranges**: Customize amplitude, temperature, and accuracy ranges
- 🔄 **Smart Boundary Logic**: Automatic direction reversal with offset when hitting boundaries
- 🧪 **Built-in Test Mode**: Quick testing with predefined settings
- 📈 **Real-time Monitoring**: Live status and position tracking
- 🛡️ **Error Handling**: Automatic retry logic and comprehensive error reporting

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <your-repo>
cd iot-sensor-simulator
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

### 3. Run Quick Test

```bash
curl -X POST http://localhost:3000/test
```

## 📦 Installation

### Prerequisites

- Node.js 18+
- TypeScript
- npm or yarn

### Install Dependencies

```bash
npm install
```

### Available Scripts

```bash
npm run dev      # Start development server with hot reload
npm run build    # Build for production
npm run start    # Start production server
npm run deploy   # Deploy to Google Cloud Functions
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file:

```env
PORT=3000
NODE_ENV=development
```

### Simulation Configuration

The simulator accepts a configuration object with these parameters:

```typescript
interface SimulationConfig {
  boundingBox: BoundingBox;      // GPS boundaries
  durationMinutes: number;       // Total simulation time
  macAddresses: string[];        // List of MAC addresses
  endpoints: string[];           // Target endpoints
  sendIntervalMs: number;        // Data send interval
  dataRanges?: DataRanges;       // Optional data ranges
}
```

#### Bounding Box

Define the GPS area where sensors will move:

```javascript
{
  "boundingBox": {
    "north": 48.9021,    // Northern boundary
    "south": 48.8155,    // Southern boundary
    "east": 2.4699,      // Eastern boundary
    "west": 2.2241       // Western boundary
  }
}
```

#### Data Ranges (Optional)

Customize sensor data ranges:

```javascript
{
  "dataRanges": {
    "amplitude": { "min": 50000, "max": 120000 },   // Vibration amplitude
    "temperature": { "min": 15, "max": 35 },        // Temperature in °C
    "accuracy": { "min": 2, "max": 8 }              // GPS accuracy in meters
  }
}
```

**Default Ranges:**

- **Amplitude**: 100 - 150,000
- **Temperature**: -20°C to 50°C
- **Accuracy**: 1-10 meters

## 🔗 API Endpoints

### Control Endpoints

| Method | Endpoint  | Description                         |
| ------ | --------- | ----------------------------------- |
| `POST` | `/start`  | Start simulation with custom config |
| `POST` | `/test`   | Test config sent simulation         |
| `POST` | `/stop`   | Stop running simulation             |
| `GET`  | `/status` | Get simulation status               |
| `GET`  | `/health` | Health check                        |
| `GET`  | `/`       | API documentation                   |

## 📖 Usage Examples

### 1. Basic Simulation

```bash
curl -X POST http://localhost:3000/start \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "boundingBox": {
        "north": 48.9021,
        "south": 48.8155,
        "east": 2.4699,
        "west": 2.2241
      },
      "durationMinutes": 30,
      "macAddresses": [
        "AA:BB:CC:DD:EE:01",
        "AA:BB:CC:DD:EE:02"
      ],
      "endpoints": [
        "https://your-cloud-run.run.app/api/sensor-data"
      ],
      "sendIntervalMs": 1000
    }
  }'
```

### 2. Industrial Testing Simulation

```bash
curl -X POST http://localhost:3000/start \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "boundingBox": {
        "north": 48.8700,
        "south": 48.8500,
        "east": 2.3700,
        "west": 2.3300
      },
      "durationMinutes": 120,
      "macAddresses": [
        "INDUSTRIAL:01:02:03",
        "INDUSTRIAL:04:05:06",
        "INDUSTRIAL:07:08:09"
      ],
      "endpoints": [
        "https://endpoint1.run.app/api/data",
        "https://endpoint2.run.app/api/data"
      ],
      "sendIntervalMs": 500,
      "dataRanges": {
        "amplitude": { "min": 80000, "max": 140000 },
        "temperature": { "min": 25, "max": 45 },
        "accuracy": { "min": 0.5, "max": 2.0 }
      }
    }
  }'
```

### 3. Load Testing

```bash
curl -X POST http://localhost:3000/start \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "boundingBox": {
        "north": 48.9021,
        "south": 48.8155,
        "east": 2.4699,
        "west": 2.2241
      },
      "durationMinutes": 60,
      "macAddresses": [
        "LOAD:01", "LOAD:02", "LOAD:03", "LOAD:04", "LOAD:05",
        "LOAD:06", "LOAD:07", "LOAD:08", "LOAD:09", "LOAD:10"
      ],
      "endpoints": [
        "https://your-endpoint.run.app/api/sensor-data"
      ],
      "sendIntervalMs": 1000
    }
  }'
```

### 4. Check Status

```bash
curl http://localhost:3000/status
```

Response:

```json
{
  "isRunning": true,
  "totalSensors": 3,
  "activeSensors": 3,
  "config": { ... },
  "sensorPositions": [
    {
      "id": "sensor-1",
      "macAddress": "AA:BB:CC:DD:EE:01",
      "position": {
        "latitude": 48.8566,
        "longitude": 2.3522
      },
      "direction": "north"
    }
  ]
}
```

### 5. Stop Simulation

```bash
curl -X POST http://localhost:3000/stop
```

## 🚀 Deployment

### Google Cloud Functions

1. **Setup GCP CLI**

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

2. **Deploy**

```bash
npm run deploy
```

3. **Use Cloud Function**

```bash
curl -X POST https://REGION-PROJECT_ID.cloudfunctions.net/iot-simulator/start \
  -H "Content-Type: application/json" \
  -d '{"config": {...}}'
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 8080
CMD ["npm", "start"]
```

### Cloud Run

```bash
# Build and deploy
gcloud run deploy iot-simulator \
  --source . \
  --region=europe-west1 \
  --allow-unauthenticated
```

## 📡 Data Format

### Sensor Data Structure

The simulator sends data in this format:

```json
{
  "timestamp": 1703875200,
  "MACAddress": "AA:BB:CC:DD:EE:01",
  "payload": {
    "acqtime": 1703875200,
    "MACAddress": "AA:BB:CC:DD:EE:01",
    "vibrations": [
      {
        "frequency": 125.7,
        "amplitude": 98432.1
      }
    ],
    "temperatures": [23.4],
    "coordinates": [
      {
        "latitude": 48.8566,
        "longitude": 2.3522
      }
    ],
    "accuracies": [3.2]
  }
}
```

### Data Fields

| Field                  | Type   | Description                           |
| ---------------------- | ------ | ------------------------------------- |
| `timestamp`            | number | Unix timestamp                        |
| `MACAddress`           | string | Sensor MAC address                    |
| `payload.acqtime`      | number | Data acquisition time                 |
| `payload.vibrations`   | array  | Vibration data (frequency, amplitude) |
| `payload.temperatures` | array  | Temperature readings in °C            |
| `payload.coordinates`  | array  | GPS coordinates (lat, lng)            |
| `payload.accuracies`   | array  | GPS accuracy in meters                |

## 🛠️ Troubleshooting

### Common Issues

#### 1. Sensors Not Moving

```bash
# Check if simulation is running
curl http://localhost:3000/status

# Verify bounding box is valid
# Ensure north > south and east > west
```

#### 2. Endpoint Connection Failures

```bash
# Test endpoint manually
curl -X POST https://your-endpoint.com/api/sensor-data \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Check simulator logs for retry attempts
```

#### 3. Sensors Going Outside Bounds

The simulator automatically handles boundary violations:

- Reverses direction
- Applies 2m offset
- Uses reverse offset if needed
- Implements fallback to current position

#### 4. Performance Issues

```bash
# Reduce send frequency
"sendIntervalMs": 5000  # Send every 5 seconds

# Reduce sensor count
"macAddresses": ["SENSOR:01"]  # Single sensor

# Use fewer endpoints
"endpoints": ["https://single-endpoint.com/api/data"]
```

### Debug Mode

Enable detailed logging:

```bash
NODE_ENV=development npm run dev
```

### Health Checks

Monitor simulation health:

```bash
# Basic health
curl http://localhost:3000/health

# Detailed status
curl http://localhost:3000/status
```

## 📊 Performance Guidelines

### Recommended Limits

| Scenario         | Sensors | Interval   | Duration   |
| ---------------- | ------- | ---------- | ---------- |
| **Development**  | 1-5     | 2000ms     | 10-30 min  |
| **Testing**      | 5-20    | 1000ms     | 30-60 min  |
| **Load Testing** | 20-100  | 500-1000ms | 60-180 min |

### Resource Usage

- **Memory**: ~50MB base + ~5MB per sensor
- **CPU**: Minimal (mostly I/O bound)
- **Network**: ~1KB per sensor per second

## 🔧 Configuration Presets

### Urban Environment

```json
{
  "dataRanges": {
    "amplitude": { "min": 1000, "max": 15000 },
    "temperature": { "min": 10, "max": 30 },
    "accuracy": { "min": 3, "max": 8 }
  }
}
```

### Industrial Environment

```json
{
  "dataRanges": {
    "amplitude": { "min": 80000, "max": 140000 },
    "temperature": { "min": 25, "max": 45 },
    "accuracy": { "min": 0.5, "max": 2.0 }
  }
}
```

### High-Precision Testing

```json
{
  "dataRanges": {
    "amplitude": { "min": 5000, "max": 5100 },
    "temperature": { "min": 20, "max": 21 },
    "accuracy": { "min": 1, "max": 1.1 }
  }
}
```
