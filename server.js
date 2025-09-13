import express from 'express';
import cors from 'cors';
import { config } from './config/config.js';
import connectDB from './DB/db.js'
import productRouter from './API/products/productRouter.js'
import clientRouter from './API/clients/clientRouter.js'
import transactionRouter from './API/transaction/transactionRouter.js'
import path from 'path';
import { fileURLToPath } from 'url';
// import authRouter from './API/auth/authRouter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// const redis = new redis()

(async () => {
    console.log('🟢🟢 Starting server...🟢🟢');
    await connectDB()

    app.use(cors({
        origin: (origin, callback) => {
            if (!origin || ['http://localhost:5173', config.apixBase].includes(origin)) {
                callback(null, true);
            } else {
                callback(null, false); // return false instead of throwing
            }
        },
        credentials: true,
    }));

    app.use(express.json());

    app.get('/', (req, res) => {
        res.status(200).json({ message: 'Welcome to the Electron API' });
    })
    app.use('/api/products', productRouter);
    app.use('/api/clients', clientRouter);
    app.use('/api/transaction', transactionRouter);
    // app.use('/api/auth', authRouter)
    app.use('/updates', express.static(__dirname))

    app.get('/api/health', (req, res) => {
        res.status(200).json({ status: 'Server is running', timestamp: new Date().toISOString() });
    });

    // Global error handler
    app.use((err, req, res, next) => {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    });



    app.listen(config.port, () => {
        console.log(`❗ Server is running on port ${config.port}`);
    })
})()

