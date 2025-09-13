import express from 'express'
import { createQR, verifyQR, checkSessionStatus } from './authController.js';

const authRouter = express.Router()

authRouter.get('/qr', createQR)
authRouter.post('/verify', verifyQR)
authRouter.get('/status/:sessionId', checkSessionStatus)


export default authRouter;