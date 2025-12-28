import express from 'express'
import { transferAmount } from './transferController.js';

const transferRouter = express.Router()

transferRouter.post('/', transferAmount)

export default transferRouter;