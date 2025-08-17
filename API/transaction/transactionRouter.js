import express from 'express'
import { createTransaction, deleteTransaction, getAllTransactions, getTransactionById, updateTransaction } from './transactionController.js'

const transactionRouter = express.Router()

transactionRouter.get('/', getAllTransactions)
transactionRouter.get('/:id', getTransactionById)
transactionRouter.post('/', createTransaction)
transactionRouter.put('/:id', updateTransaction)
transactionRouter.delete('/:id', deleteTransaction)

export default transactionRouter;