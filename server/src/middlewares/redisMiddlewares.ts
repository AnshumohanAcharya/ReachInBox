import Redis from "ioredis";

const redisOptions = () => {
  if (process.env.REDIS_URL) {
    console.log(`Redis connected!`);
    return process.env.REDIS_URL;
  }
  throw new Error("Redis Connection Failed");
};

const redisConnection = new Redis(redisOptions(),{
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
});
export { redisConnection };
