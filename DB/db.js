import mongoose from 'mongoose'
import { config } from '../config/config';

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {

  if (cached.conn) {
    return cached.conn; // reuse existing connection
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(config.mongoURL, {
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // 5 seconds
      socketTimeoutMS: 45000, // 45 seconds
    }).then((mongoose) => mongoose);
    mongoose.connection.on('connected', () => {
      console.log('✅✅ Connected to MongoDB ✅✅')
    })
  }
  cached.conn = await cached.promise;
  return cached.conn;
};

export default connectDB;

// try {
//   const conn = await mongoose.connect(config.mongoURL, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//     serverSelectionTimeoutMS: 5000, // 5 seconds
//     socketTimeoutMS: 45000, // 45 seconds
//   });

//   mongoose.connection.on('connected', () => {
//     console.log('✅✅ Connected to MongoDB ✅✅')
//   })
//   return conn;
// } catch (error) {
//   console.error('Database connection failed:', error);
//   throw error;
// }
// };

// export default connectDB
