import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://:redis123456@localhost:14018';

const redis = new Redis(redisUrl);

export default redis;
