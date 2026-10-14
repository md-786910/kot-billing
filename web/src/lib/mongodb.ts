import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || '';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
   
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!MONGODB_URI) {
    throw new Error(
      'MONGODB_URI is not defined in environment variables. Please configure your MongoDB Atlas connection string in .env.local.'
    );
  }

  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      // Small pools: on Vercel every function instance opens its own, and Atlas limits total connections
      maxPoolSize: 10,
      minPoolSize: 0,
      maxIdleTimeMS: 60_000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip IPv6 resolution delays
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectToDatabase;
