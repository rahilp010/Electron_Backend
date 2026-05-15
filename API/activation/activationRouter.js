import express from 'express';
import {
  validateKey,
  activateKey,
  listKeys,
  revokeKey,
  createKey,
  bulkCreateKeys,
} from './activationController.js';

const activationRouter = express.Router();

// ── Client endpoints (called from Electron app) ──
activationRouter.post('/validate', validateKey);
activationRouter.post('/activate', activateKey);

// ── Admin endpoints (protected by x-admin-secret header) ──
activationRouter.get('/keys', listKeys);
activationRouter.post('/keys/revoke', revokeKey);
activationRouter.post('/keys/create', createKey);
activationRouter.post('/keys/bulk', bulkCreateKeys);

export default activationRouter;
