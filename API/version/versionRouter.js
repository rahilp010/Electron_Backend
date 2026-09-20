import express from 'express';
import {
  getAdminSession,
  getVersion,
  getVersionAdminPage,
  getUploadSignature,
  loginVersionAdmin,
  logoutVersionAdmin,
  updateVersion,
  getTargetedVersions,
  deleteTargetedVersion,
} from './versionController.js';

const versionRouter = express.Router();

versionRouter.get('/', getVersion);
versionRouter.get('/admin', getVersionAdminPage);
versionRouter.get('/admin/session', getAdminSession);
versionRouter.get('/admin/targeted', getTargetedVersions);
versionRouter.delete('/admin/targeted/:id', deleteTargetedVersion);
versionRouter.post('/admin/upload-signature', getUploadSignature);
versionRouter.post('/admin/login', loginVersionAdmin);
versionRouter.post('/admin/logout', logoutVersionAdmin);
versionRouter.post('/update', updateVersion);

export default versionRouter;
