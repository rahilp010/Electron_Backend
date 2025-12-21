import express from 'express'
import { deleteAccount, getAccountById, getAllAccounts, updateAccount } from './accountController.js'

const accountRouter = express.Router()

accountRouter.get('/', getAllAccounts)
accountRouter.get('/:id', getAccountById)
accountRouter.put('/:id', updateAccount)
accountRouter.delete('/:id', deleteAccount)

export default accountRouter;