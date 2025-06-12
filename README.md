# Tenco Admin Dashboard

A comprehensive administration dashboard and development tools platform for IoT applications, featuring Redis management and sensor simulation capabilities.

## 🚀 Features

### Dashboard

- **Unified Interface**: Clean and modern dashboard with quick access to all tools
- **Service Status**: Real-time monitoring of all integrated services
- **Responsive Design**: Mobile-friendly interface with modern UI/UX

### Redis Commander

- **Database Management**: Complete Redis database visualization and management
- **Multi-Database Support**: Browse and manage multiple Redis databases
- **Key Operations**: View, edit, delete keys with support for all Redis data types
- **Real-time Statistics**: Monitor Redis performance and memory usage
- **Pattern Search**: Advanced key filtering and pattern matching

### IoT Simulator

- **Multi-Sensor Simulation**: Generate realistic sensor data for testing
- **Geolocation Support**: GPS coordinates with configurable boundaries
- **Data Types**: Temperature, vibration, and environmental sensors
- **Flexible Configuration**: Customizable sensor parameters and intervals
- **Real-time Monitoring**: Live status and data flow visualization

## 📋 Requirements

- **Node.js**: >= 18.0.0
- **Redis**: Running Redis instance (local or remote)
- **Google Cloud Platform**: For deployment and logging (optional)

## 🛠 Installation

### Local Development

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd admin-app-tenco
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment**

   ```bash
   cp .env.dist .env
   ```

   Edit `.env` with your configuration:

   ```env
   NODE_ENV=development
   PORT=8080

   # Redis Configuration
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=your-password-if-any

   # Google Cloud Platform
   GCP_PROJECT_ID=your-project-id
   GCP_LOGGER_NAME=admin-app-tenco

   # IoT Simulator
   SERVICE_SENSOR_DATA_DISPATCHER_URL=your-endpoint-url
   ```

4. **Start development server**

   ```bash
   npm run start:dev
   ```

5. **Access the application**
   - Dashboard: http://localhost:8080
   - Redis Commander: http://localhost:8080/redis-commander
   - IoT Simulator: http://localhost:8080/iot-simulator

## 🏗 Build and Production

### Build the application

```bash
npm run build
```

### Start production server

```bash
npm start
```

### Docker Deployment

```bash
# Build Docker image
docker build -t tenco-admin .

# Run container
docker run -p 8080:8080 --env-file .env tenco-admin
```

## ☁️ Cloud Deployment

### Google Cloud Run

The application is designed for Cloud Run deployment with the included GitHub Actions workflow.

#### Prerequisites

- Google Cloud Project with Cloud Run enabled
- Service Account with appropriate permissions
- Redis instance (Google Cloud Memorystore or external)

#### Environment Variables for Cloud Run

```env
NODE_ENV=production
PORT=8080
GCP_PROJECT_ID=your-project-id
GCP_LOGGER_NAME=admin-app-tenco
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
SERVICE_SENSOR_DATA_DISPATCHER_URL=your-endpoint
```

#### GitHub Actions Deployment

1. Configure repository secrets:

   - `GCLOUD_PROJECT_ID_STAGING`
   - `GCLOUD_SERVICE_KEY_STAGING`
   - `GCP_SERVICE_ACCOUNT_STAGING`

2. Configure repository variables:

   - `REDIS_HOST_STAGING`
   - `REDIS_PORT_STAGING`
   - `SERVICE_SENSOR_DATA_DISPATCHER_URL_STAGING`

3. Trigger deployment via GitHub Actions or push to `dev` branch

## 🔧 Development

### Available Scripts

- `npm run start:dev` - Start development server with hot reload
- `npm run build` - Build production bundle
- `npm run start` - Start production server
- `npm run lint` - Run ESLint and TypeScript checks
- `npm run lint:fix` - Fix linting issues automatically
- `npm run typecheck` - Run TypeScript type checking
- `npm run clean` - Clean build directory

### Code Quality

The project includes comprehensive code quality tools:

- **ESLint**: Code linting with Airbnb TypeScript configuration
- **Prettier**: Code formatting
- **Husky**: Git hooks for pre-commit checks
- **TypeScript**: Static type checking
- **Commitlint**: Conventional commit message format

### Git Workflow

```bash
# Install git hooks
npm run husky:prepare

# Commits are automatically linted and formatted
git add .
git commit -m "feat: add new feature"
```

## 📁 Project Structure

```
src/
├── controllers/           # Request handlers and business logic
│   ├── dashboard.controller.ts
│   ├── iot-simulator.controller.ts
│   └── redis-commander.controller.ts
├── routes/               # API route definitions
│   ├── index.ts
│   └── routes.const.ts
├── services/             # Business logic and external integrations
├── utils/                # Utility functions and helpers
│   ├── gcp/              # Google Cloud Platform utilities
│   ├── redis/            # Redis client and configuration
│   └── server.ts         # Express server configuration
├── config/               # Application configuration
└── types/                # TypeScript type definitions
```

## 🔌 API Endpoints

### Dashboard

- `GET /` - Main dashboard interface
- `GET /dashboard` - Alternative dashboard route

### Redis Commander

- `GET /redis-commander` - Redis management interface
- `GET /redis-commander/api/info` - Redis server information
- `GET /redis-commander/api/keys` - List Redis keys
- `GET /redis-commander/api/key/:key` - Get key value
- `DELETE /redis-commander/api/key/:key` - Delete key
- `GET /redis-commander/health` - Redis health check

### IoT Simulator

- `GET /iot-simulator` - Simulator interface
- `POST /iot-simulator/start` - Start simulation
- `POST /iot-simulator/stop` - Stop simulation
- `GET /iot-simulator/status` - Get simulation status
- `POST /iot-simulator/test` - Test configuration
- `GET /iot-simulator/health` - Health check

## 🔒 Security

### Environment Variables

- All sensitive data should be stored in environment variables
- Use `.env` files for local development (not committed to git)
- Cloud deployment uses secure secret management

### Redis Security

- Configure Redis password if exposed to public networks
- Use Redis AUTH if authentication is enabled
- Consider Redis SSL/TLS for production environments

### Cloud Security

- Service Account with minimal required permissions
- Private Redis instances when possible
- HTTPS-only in production (handled by Cloud Run)

## 🐛 Troubleshooting

### Common Issues

#### Redis Connection Failed

```bash
# Check Redis server status
redis-cli ping

# Verify connection parameters
echo $REDIS_HOST $REDIS_PORT
```

#### Build Errors

```bash
# Clean and rebuild
npm run clean
npm run build

# Check TypeScript configuration
npm run typecheck
```

#### Memory Issues

```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm start
```

### Development Debugging

```bash
# Enable debug logging
export DEBUG=true
npm run start:dev

# Check Google Cloud logs (if configured)
gcloud logging read "resource.type=cloud_run_revision"
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes following the coding standards
4. Run tests and linting: `npm run lint`
5. Commit your changes: `git commit -m "feat: add new feature"`
6. Push to the branch: `git push origin feature/new-feature`
7. Submit a pull request

### Code Standards

- Follow TypeScript and ESLint configurations
- Use conventional commit messages
- Add JSDoc comments for public functions
- Maintain test coverage for new features

## 📄 License

ISC License - see LICENSE file for details.

## 👨‍💻 Author

**D. Rambourg**

For support or questions, please open an issue in the repository.

---

## 🔗 Related Documentation

- [Express.js Documentation](https://expressjs.com/)
- [Redis Documentation](https://redis.io/documentation)
- [Google Cloud Run Documentation](https://cloud.google.com/run/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
