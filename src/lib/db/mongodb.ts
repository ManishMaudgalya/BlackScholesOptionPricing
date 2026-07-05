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
  const connectionString = (process.env.MONGODB_URI || process.env.MONGO_MONGODB_URI || "").trim();
  if (!connectionString || connectionString.includes("your_mongodb_connection_string_here")) {
    throw new Error(
      "MongoDB URI is not configured. Set MONGODB_URI locally or MONGO_MONGODB_URI on Vercel before using MongoDB features.",
    );
  }

  const dbName = process.env.MONGODB_DB_NAME?.trim();

  if (cache.connection) {
    return cache.connection;
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(connectionString, {
      bufferCommands: false,
      ...(dbName ? { dbName } : {}),
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
