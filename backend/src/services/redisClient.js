import Redis from 'ioredis';
import { config } from '../utils/config.js';

function buildRedisClient() {
  if (!config.redisUrl) {
    console.warn('[Redis] REDIS_URL not set. Redis features will fail.');
  }

  // Ensure scheme present; default to redis:// if missing
  let url = config.redisUrl || 'redis-17416.c100.us-east-1-4.ec2.redns.redis-cloud.com:17416';
  if (!/^rediss?:\/\//i.test(url)) {
    url = `redis://${url}`;
  }

  const isTls = /^rediss:\/\//i.test(url);

  const opts = {
    username: config.redisUsername || undefined,
    password: config.redisPassword || undefined,
    lazyConnect: false,
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
  };

  if (isTls) {
    // Enable TLS if using rediss:// (managed providers)
    opts.tls = {};
  }

  const client = new Redis(url, opts);

  client.on('error', (err) => {
    console.error('[Redis] error:', err?.message || err);
  });
  client.on('ready', () => {
    console.log('[Redis] connected');
  });
  return client;
}

const redis = buildRedisClient();

redis.on('error', (err) => {
  // Prevent unhandled error events (e.g., NOAUTH)
  console.error('[Redis] error:', err?.message || err);
});

export const pushMessage = async (sessionId, role, content) => {
  try {
    const key = `chat:${sessionId}`;
    const entry = JSON.stringify({ role, content, ts: Date.now() });
    await redis.rpush(key, entry);
    await redis.expire(key, config.sessionTTL);
  } catch (err) {
    console.error('[Redis] pushMessage failed:', err?.message || err);
    throw err;
  }
};

export const getHistory = async (sessionId) => {
  try {
    const key = `chat:${sessionId}`;
    const items = await redis.lrange(key, 0, -1);
    return items.map((i) => JSON.parse(i));
  } catch (err) {
    console.error('[Redis] getHistory failed:', err?.message || err);
    throw err;
  }
};

export const resetHistory = async (sessionId) => {
  try {
    const key = `chat:${sessionId}`;
    await redis.del(key);
  } catch (err) {
    console.error('[Redis] resetHistory failed:', err?.message || err);
    throw err;
  }
};

export default redis;
