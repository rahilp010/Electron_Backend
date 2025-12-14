import express from 'express'
import { createSales, deleteSales, getAllSales, getSalesById, updateSales } from './salesController.js'

const salesRouter = express.Router()

salesRouter.get('/', getAllSales)
salesRouter.get('/:id', getSalesById)
salesRouter.post('/', createSales)
salesRouter.put('/:id', updateSales)
salesRouter.delete('/:id', deleteSales)

export default salesRouter;