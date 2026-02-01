import express from 'express'
import { createPurchase, deletePurchase, getAllPurchases, getPurchaseById, updatePurchase } from './purchaseController.js'
import { authMiddleware } from '../../middleware/authMiddleware.js'

const purchaseRouter = express.Router()

purchaseRouter.get('/', authMiddleware, getAllPurchases)
purchaseRouter.get('/:id', authMiddleware, getPurchaseById)
purchaseRouter.post('/', authMiddleware, createPurchase)
purchaseRouter.put('/:id', authMiddleware, updatePurchase)
purchaseRouter.delete('/:id', authMiddleware, deletePurchase)

export default purchaseRouter;