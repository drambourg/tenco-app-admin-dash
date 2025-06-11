import Redis from 'ioredis';

type RedisClientType = 'main' | 'subscriber' | 'publisher';

interface RedisClientInfo {
  client: Redis | null;
  connected: boolean;
  type: RedisClientType;
  description: string;
}

export { RedisClientInfo, RedisClientType };
