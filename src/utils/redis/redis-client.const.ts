import { RedisClientInfo, RedisClientType } from './redis-client.type';

const REDIS_CLIENTS: Record<RedisClientType, RedisClientInfo> = {
  main: {
    client: null,
    connected: false,
    description: 'Main client for cache operations (GET, SET, HGETALL, etc.)',
    type: 'main',
  },
  publisher: {
    client: null,
    connected: false,
    description: 'Dedicated client for publishing messages',
    type: 'publisher',
  },
  subscriber: {
    client: null,
    connected: false,
    description: 'Dedicated client for SSE pub/sub subscriptions',
    type: 'subscriber',
  },
};

export default REDIS_CLIENTS;
