import express from 'express'
import { createSales, deleteSales, getAllSales, getSalesById, updateSales } from './salesController.js'
import { authMiddleware } from '../../Middleware/authMiddleware.js'

const salesRouter = express.Router()

salesRouter.get('/', authMiddleware, getAllSales)
salesRouter.get('/:id', authMiddleware, getSalesById)
salesRouter.post('/', authMiddleware, createSales)
salesRouter.put('/:id', authMiddleware, updateSales)
salesRouter.delete('/:id', authMiddleware, deleteSales)

export default salesRouter;