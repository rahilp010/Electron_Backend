import express from 'express';
import {
  getAdminSession,
  getVersion,
  loginVersionAdmin,
  logoutVersionAdmin,
  updateVersion,
} from './versionController.js';

const versionRouter = express.Router();

versionRouter.get('/', getVersion);
versionRouter.get('/admin/session', getAdminSession);
versionRouter.post('/admin/login', loginVersionAdmin);
versionRouter.post('/admin/logout', logoutVersionAdmin);
versionRouter.put('/admin', updateVersion);

export default versionRouter;
