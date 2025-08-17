import express from 'express';
import cors from 'cors';
import { config } from './config/config.js';
import connectDB from './db.js'

const createApp = async () => {
    const app = express();

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

    const productRouter = (await import('./products/productRouter.js')).default;
    const clientRouter = (await import('./clients/clientRouter.js')).default;
    const transactionRouter = (await import('./transaction/transactionRouter.js')).default;

    app.get('/', (res) => {
        res.send('Welcome to the Electron API')
    })
    app.use('/api/products', productRouter);
    app.use('/api/clients', clientRouter);
    app.use('/api/transaction', transactionRouter);

    app.get('/api/health', (res) => {
        res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
    });

    // Global error handler
    app.use((err, req, res, next) => {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    });

    return app;
}

const server = createApp()

server.listen(config.port, () => {
    console.log(`✅✅ Server is running on port ${config.port}`);
})


export default server;
