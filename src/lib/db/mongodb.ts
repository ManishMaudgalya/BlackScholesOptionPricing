import mongoose from "mongoose";

declare global {
  var mongooseCache:
    | {
        connection: typeof mongoose | null;
        promise: Promise<typeof mongoose> | null;
      }
    | undefined;
}

const cache = global.mongooseCache ?? {
  connection: null,
  promise: null,
};

global.mongooseCache = cache;

export async function connectToDatabase() {
  const connectionString = process.env.MONGODB_URI;
  if (!connectionString || connectionString.includes("your_mongodb_connection_string_here")) {
    throw new Error("MONGODB_URI is not configured. Add it to .env.local before using MongoDB features.");
  }

  if (cache.connection) {
    return cache.connection;
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(connectionString, {
      bufferCommands: false,
    });
  }

  try {
    cache.connection = await cache.promise;
    return cache.connection;
  } catch (error) {
    cache.promise = null;
    throw error;
  }
}
