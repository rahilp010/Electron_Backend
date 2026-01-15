import express from 'express';
import cors from 'cors';
import { config } from './config/config.js';
import connectDB from './DB/db.js'
import productRouter from './API/products/productRouter.js'
import clientRouter from './API/clients/clientRouter.js'
import path from 'path';
import { fileURLToPath } from 'url';
import versionController from './API/version/versionController.js';
import purchaseRouter from './API/purchase/purchaseRouter.js';
import salesRouter from './API/sales/salesRouter.js';
import accountRouter from './API/bankAccounts/accounts/accountRouter.js';
import ledgerRouter from './API/bankAccounts/ladger/ladgerRouter.js';
import transferRouter from './API/bankAccounts/transferAmount/transferRouter.js';
import analyticsRouter from './API/analytics/analyticsRouter.js';
import openSalesPDFRouter from './API/utils/pdf.js';
import pendingReport from './API/utils/pendingReportController.js';
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
    app.use('/api/purchase', purchaseRouter);
    app.use('/api/sales', salesRouter);
    app.use('/api/account', accountRouter);
    app.use('/api/ledger', ledgerRouter);
    app.use('/api/transfer', transferRouter)
    app.use('/api/analytics', analyticsRouter)
    app.use('/api/version', versionController)
    app.use('/api/sales', openSalesPDFRouter)
    app.use('/api/reports', pendingReport)
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

