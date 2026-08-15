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

const INVALID_DATABASE_NAME_CHARS = /[./\\ "$]/;

function resolveDatabaseName() {
  const dbName = (process.env.MONGODB_DB_NAME || process.env.MONGO_MONGODB_DATABASE || "").trim();
  if (!dbName) {
    return undefined;
  }

  if (INVALID_DATABASE_NAME_CHARS.test(dbName)) {
    throw new Error(
      "MongoDB database name is invalid. Set MONGODB_DB_NAME or MONGO_MONGODB_DATABASE to only the database name, for example black_scholes_app. Do not use a MongoDB URI, hostname, or a name containing '.', '/', spaces, quotes, '$', or '\\'.",
    );
  }

  return dbName;
}

export async function connectToDatabase() {
  const connectionString = (process.env.MONGODB_URI || process.env.MONGO_MONGODB_URI || "").trim();
  if (!connectionString || connectionString.includes("your_mongodb_connection_string_here")) {
    throw new Error(
      "MongoDB URI is not configured. Set MONGODB_URI locally or MONGO_MONGODB_URI on Vercel before using MongoDB features.",
    );
  }

  const dbName = resolveDatabaseName();

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
