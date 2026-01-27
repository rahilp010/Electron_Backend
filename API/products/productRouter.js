import express from 'express'
import { createProduct, getAllProducts, getProductById, updateProduct, deleteProduct } from './productController.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';

const productRouter = express.Router()

productRouter.get('/', authMiddleware, getAllProducts)
productRouter.get('/:id', authMiddleware, getProductById)
productRouter.post('/', authMiddleware, createProduct)
productRouter.put('/:id', authMiddleware, updateProduct)
productRouter.delete('/:id', authMiddleware, deleteProduct)

export default productRouter;