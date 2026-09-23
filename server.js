// ── Polyfill wmic.exe for Windows 11 (where wmic is deprecated/removed) ──
// This MUST run before any imports that might spawn wmic.exe (e.g. puppeteer, open-wa).
import child_process from 'child_process';

if (process.platform === 'win32') {
  const wbem = 'C:\\Windows\\System32\\wbem';
  const sys32 = 'C:\\Windows\\System32';
  if (!process.env.PATH?.includes(wbem)) {
    process.env.PATH = `${wbem};${sys32};${process.env.PATH || ''}`;
  }

  const isWmic = (cmd) =>
    typeof cmd === 'string' && (cmd.toLowerCase().includes('wmic') || cmd.endsWith('wmic.exe'));

  const PS_ARGS = [
    '-NoProfile',
    '-Command',
    'Get-CimInstance Win32_Process | Select-Object Name, ProcessId, ParentProcessId, Status | ConvertTo-Csv -NoTypeInformation'
  ];

  // Intercept spawn
  const originalSpawn = child_process.spawn;
  child_process.spawn = function (command, args, options) {
    if (isWmic(command)) {
      console.log('🔄 Intercepting wmic.exe spawn call, redirecting to PowerShell');
      const psProcess = originalSpawn.call(this, 'powershell.exe', PS_ARGS, options);
      psProcess.stderr = { on: () => {}, pipe: () => {} };
      return psProcess;
    }
    return originalSpawn.apply(this, arguments);
  };

  // Intercept execFile
  const originalExecFile = child_process.execFile;
  child_process.execFile = function (file, args, options, callback) {
    if (isWmic(file)) {
      console.log('🔄 Intercepting wmic.exe execFile call, redirecting to PowerShell');
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }
      return originalExecFile.call(this, 'powershell.exe', PS_ARGS, options, callback);
    }
    return originalExecFile.apply(this, arguments);
  };

  // Intercept exec
  const originalExec = child_process.exec;
  child_process.exec = function (command, options, callback) {
    if (isWmic(command)) {
      console.log('🔄 Intercepting wmic.exe exec call, redirecting to PowerShell');
      const psCommand = `powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process | Select-Object Name, ProcessId, ParentProcessId, Status | ConvertTo-Csv -NoTypeInformation"`;
      return originalExec.call(this, psCommand, options, callback);
    }
    return originalExec.apply(this, arguments);
  };

  // Intercept execSync
  const originalExecSync = child_process.execSync;
  child_process.execSync = function (command, options) {
    if (isWmic(command)) {
      console.log('🔄 Intercepting wmic.exe execSync call, redirecting to PowerShell');
      const psCommand = `powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process | Select-Object Name, ProcessId, ParentProcessId, Status | ConvertTo-Csv -NoTypeInformation"`;
      return originalExecSync.call(this, psCommand, options);
    }
    return originalExecSync.apply(this, arguments);
  };
}

// Handle uncaught errors to prevent server crash from wmic.exe / whatsapp-web.js
process.on('uncaughtException', (err) => {
  const msg = err?.message || ''
  if (msg.includes('wmic.exe') || msg.includes('LocalWebCache') || msg.includes('properties of null')) {
    console.error('⚠️ WhatsApp non-fatal exception (suppressed):', msg);
    return; // Don't crash the server
  }
  console.error('Uncaught Exception:', err);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  const msg = reason?.message || String(reason || '')
  if (msg.includes('wmic.exe') || msg.includes('LocalWebCache') || msg.includes('properties of null')) {
    console.error('⚠️ WhatsApp non-fatal promise rejection (suppressed):', msg);
    return; // Don't crash the server
  }
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});


import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/config.js';
import connectDB from './DB/db.js'
import productRouter from './API/products/productRouter.js'
import clientRouter from './API/clients/clientRouter.js'
import path from 'path';
import { fileURLToPath } from 'url';
import { getVersionAdminPage } from './API/version/versionController.js';
import versionRouter from './API/version/versionRouter.js';
import purchaseRouter from './API/purchase/purchaseRouter.js';
import salesRouter from './API/sales/salesRouter.js';
import accountRouter from './API/bankAccounts/accounts/accountRouter.js';
import ledgerRouter from './API/bankAccounts/ledger/ledgerRouter.js';
import transferRouter from './API/bankAccounts/transferAmount/transferRouter.js';
import analyticsRouter from './API/analytics/analyticsRouter.js';
import pendingReport from './API/utils/pendingReportController.js';
import authRouter from './API/Auth/authRouter.js';
import reportRouter from './API/utils/reportController.js'
import activationRouter from './API/activation/activationRouter.js';
import whatsappRouter from './API/whatsapp/whatsappRouter.js';
import syncRouter from './API/sync/syncRouter.js';
import { initSyncSocket } from './services/syncSocket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// const redis = new redis()

(async () => {
    console.log('🟢🟢 Starting server...🟢🟢');
    try {
        await connectDB();
    } catch (dbError) {
        console.error('⚠️ Database connection failed. Running server in offline/local mode.', dbError.message);
        // Retry in the background so the server comes up as soon as MongoDB is reachable
        // (connectDB no longer caches the failed promise, so a retry is possible).
        const retryDb = async () => {
            try {
                await connectDB();
                console.log('✅ Database connected on retry.');
            } catch {
                setTimeout(retryDb, 10_000); // try again in 10s
            }
        };
        setTimeout(retryDb, 10_000);
    }

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
    app.use(cookieParser());

    app.get('/', (req, res) => {
        getVersionAdminPage(req, res);
    })
    app.get('/favicon.ico', (req, res) => {
        res.sendFile(path.join(__dirname, 'services', 'Envy.png'));
    });
    app.use('/api/products', productRouter);
    app.use('/api/clients', clientRouter);
    app.use('/api/purchase', purchaseRouter);
    app.use('/api/sales', salesRouter);
    app.use('/api/account', accountRouter);
    app.use('/api/ledger', ledgerRouter);
    app.use('/api/transfer', transferRouter)
    app.use('/api/analytics', analyticsRouter)
    app.use('/api/version', versionRouter)
    app.use('/api/reports', pendingReport)
    app.use('/api/auth', authRouter)
    app.use('/api/activation', activationRouter)
    app.use('/api/whatsapp', whatsappRouter)
    app.use('/api/sync', syncRouter)
    app.use('/updates', express.static(__dirname))
    app.use('/api/generate', reportRouter)

    app.get('/api/health', (req, res) => {
        res.status(200).json({ status: 'Server is running', timestamp: new Date().toISOString() });
    });

    // Global error handler
    app.use((err, req, res, next) => {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    });


    const server = app.listen(config.port, '0.0.0.0', () => {
        console.log(`❗☑️ Server is running on port ${config.port}`);
    });

    initSyncSocket(server);

    // Keep the process alive with a setInterval
    setInterval(() => {}, 1000);
})().catch(err => {
    console.error('Server startup error:', err);
    process.exit(1);
});
