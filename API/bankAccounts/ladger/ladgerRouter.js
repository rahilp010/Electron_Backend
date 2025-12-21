import express from 'express'
import { createProduct, getAllProducts, getProductById, updateProduct, deleteProduct } from './productController.js';

const accountRouter = express.Router()

accountRouter.get('/', getAllAccounts)
accountRouter.post('/', createAccount)
accountRouter.put('/:id', updateAccount)
accountRouter.delete('/:id', deleteAccount)

export default accountRouter;