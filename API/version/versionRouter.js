import express from 'express';
import {
  getAdminSession,
  getVersion,
  getUploadSignature,
  loginVersionAdmin,
  logoutVersionAdmin,
  updateVersion,
} from './versionController.js';

const versionRouter = express.Router();

versionRouter.get('/', getVersion);
versionRouter.get('/admin/session', getAdminSession);
versionRouter.post('/admin/upload-signature', getUploadSignature);
versionRouter.post('/admin/login', loginVersionAdmin);
versionRouter.post('/admin/logout', logoutVersionAdmin);
versionRouter.post('/update', updateVersion);

export default versionRouter;
