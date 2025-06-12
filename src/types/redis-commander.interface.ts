// src/types/redis-commander.interface.ts

export interface RedisKeyInfo {
  key: string;
  type: string;
  ttl: number;
  size: number;
  encoding?: string;
}

export interface RedisValue {
  key: string;
  type: string;
  value: any;
  ttl: number;
  size: number;
  encoding?: string;
}

export interface RedisDatabaseInfo {
  db: number;
  keyCount: number;
  expires: number;
  avgTtl: number;
}

export interface RedisServerInfo {
  version: string;
  mode: string;
  connectedClients: number;
  usedMemory: string;
  usedMemoryHuman: string;
  maxMemory: string;
  maxMemoryHuman: string;
  databases: RedisDatabaseInfo[];
}

export interface RedisCommanderConfig {
  database?: number;
  pattern?: string;
  limit?: number;
  offset?: number;
}

export interface RedisKeyPattern {
  pattern: string;
  count: number;
  description: string;
}

export interface RedisCommanderResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface RedisHashValue {
  [field: string]: string;
}

export type RedisListValue = Array<string>;

export type RedisSetValue = Array<string>;

export type RedisZSetValue = Array<{
  member: string;
  score: number;
}>;

export type RedisDataType =
  | 'string'
  | 'hash'
  | 'list'
  | 'set'
  | 'zset'
  | 'stream'
  | 'none';

export interface RedisMemoryUsage {
  used: number;
  peak: number;
  rss: number;
  fragmentation: number;
}

export interface RedisStats {
  totalKeys: number;
  totalMemory: RedisMemoryUsage;
  hitRate: number;
  keyspaceHits: number;
  keyspaceMisses: number;
  connectedClients: number;
  blockedClients: number;
  version: string;
  uptime: number;
}
