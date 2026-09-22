import mongoose from 'mongoose'
import dns from 'dns'
import { config } from '../config/config.js';

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

let dnsFallbackApplied = false;

// `mongodb+srv://` URIs require SRV DNS lookups. Some networks (routers, ISPs, VPNs)
// refuse SRV queries, so the driver never finds a server and every Mongoose query
// hangs until "Operation ... buffering timed out after 10000ms".
// Detect that case and point the process resolver at public DNS servers instead.
const ensureSrvResolution = () =>
  new Promise((resolve) => {
    if (!config.mongoURL || !config.mongoURL.startsWith('mongodb+srv://')) {
      return resolve();
    }

    let hostname;
    try {
      hostname = new URL(config.mongoURL).hostname; // e.g. maindb.22denob.mongodb.net
    } catch {
      return resolve();
    }

    dns.resolveSrv(`_mongodb._tcp.${hostname}`, (err) => {
      if (!err || dnsFallbackApplied) return resolve();

      // System DNS failed for SRV — verify public resolvers can do it before switching.
      const probe = new dns.Resolver({ timeout: 3000, tries: 2 });
      probe.setServers(['1.1.1.1', '8.8.8.8']);
      probe.resolveSrv(`_mongodb._tcp.${hostname}`, (probeErr, addresses) => {
        if (!probeErr && addresses && addresses.length > 0) {
          console.warn(
            `⚠️ System DNS cannot resolve SRV records (${err.code}). Using public resolvers (1.1.1.1, 8.8.8.8) for MongoDB.`
          );
          dns.setServers(['1.1.1.1', '8.8.8.8']);
          dnsFallbackApplied = true;
        }
        resolve();
      });
    });
  });

const connectDB = async () => {
  if (cached.conn) {
    return cached.conn; // reuse existing connection
  }

  if (!cached.promise) {
    cached.promise = (async () => {
      await ensureSrvResolution();
      return mongoose.connect(config.mongoURL, {
        serverSelectionTimeoutMS: 5000, // 5 seconds
        socketTimeoutMS: 45000, // 45 seconds
      });
    })();

    mongoose.connection.on('connected', () => {
      console.log('✅✅ Connected to MongoDB ✅✅')
    })
    mongoose.connection.on('error', (err) => {
      console.error('⚠️ MongoDB connection error:', err.message)
    })
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    // Don't cache a rejected promise — allow the next connectDB() call to retry.
    cached.promise = null;
    throw err;
  }

  return cached.conn;
};

export default connectDB;
