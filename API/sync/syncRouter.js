import express from 'express';
import { initiateSync, downloadDatabase, getSyncStatus, getDbInfo, getTables, getTablePreview } from './syncController.js';
import { syncAuth } from '../../middleware/syncAuth.js';

const syncRouter = express.Router();

// Apply auth middleware to all sync routes
syncRouter.use(syncAuth);

// Initiate sync - returns a token
syncRouter.post('/initiate', initiateSync);

// Download database using token
syncRouter.get('/download/:syncToken', downloadDatabase);

// Check sync status
syncRouter.get('/status/:syncToken', getSyncStatus);

// Get database information (no auth required for health check)
syncRouter.get('/db-info', getDbInfo);

// Get tables from database (requires sync token)
syncRouter.get('/tables/:syncToken', getTables);

// Get table data preview (requires sync token and table name)
syncRouter.get('/table/:syncToken/:tableName', getTablePreview);

export default syncRouter;
