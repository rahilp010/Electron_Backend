import express from 'express'
import { register, login, updateProfile } from './authController.js';

const authRouter = express.Router()

authRouter.post('/signup', register)
authRouter.post('/login', login)
authRouter.put('/:id', updateProfile)


export default authRouter;