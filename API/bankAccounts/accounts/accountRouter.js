import express from 'express'
import { deleteAccount, getAccountById, getAllAccounts, updateAccount } from './accountController.js'
import { authMiddleware } from '../../../middleware/authMiddleware.js'

const accountRouter = express.Router()

accountRouter.get('/', authMiddleware, getAllAccounts)
accountRouter.get('/:id', authMiddleware, getAccountById)
accountRouter.put('/:id', authMiddleware, updateAccount)
accountRouter.delete('/:id', authMiddleware, deleteAccount)

export default accountRouter;