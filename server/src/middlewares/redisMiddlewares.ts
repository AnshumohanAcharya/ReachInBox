import Redis from "ioredis";

const redisOptions = () => {
  if (process.env.REDIS_HOST) {
    console.log(`Redis connected!`);
    return process.env.REDIS_HOST;
  }
  throw new Error("Redis Connected Failed");
};

const redisConnection = new Redis(redisOptions());
export { redisConnection };
