import express from 'express'
import { createProduct, getAllProducts, getProductById, updateProduct, deleteProduct } from './productController.js';

const productRouter = express.Router()

productRouter.get('/', getAllProducts)
productRouter.get('/:id', getProductById)
productRouter.post('/', createProduct)
productRouter.put('/:id', updateProduct)
productRouter.delete('/:id', deleteProduct)

export default productRouter;