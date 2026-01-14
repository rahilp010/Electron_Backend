import express from 'express'
import { getAnalytics } from './analyticsController.js';


const analyticsRouter = express.Router()

analyticsRouter.get('/', getAnalytics)

export default analyticsRouter;