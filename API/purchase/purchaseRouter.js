import express from 'express'
import { createPurchase, deletePurchase, getAllPurchases, getPurchaseById, updatePurchase } from './purchaseSchema.js'

const purchaseRouter = express.Router()

purchaseRouter.get('/', getAllPurchases)
purchaseRouter.get('/:id', getPurchaseById)
purchaseRouter.post('/', createPurchase)
purchaseRouter.put('/:id', updatePurchase)
purchaseRouter.delete('/:id', deletePurchase)

export default purchaseRouter;