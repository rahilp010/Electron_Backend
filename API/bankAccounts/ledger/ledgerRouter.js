import express from 'express'
import { addLedgerEntry, deleteLedgerEntry, getLedgerByAccount, getClientLedger, getTransferHistory, deleteMultipleLedgerEntries } from './ledgerController.js'
import { authMiddleware } from '../../../middleware/authMiddleware.js'

const ledgerRouter = express.Router()

ledgerRouter.get('/', authMiddleware, getLedgerByAccount)
ledgerRouter.get('/client/:clientId', authMiddleware, getClientLedger)
ledgerRouter.get('/history', authMiddleware, getTransferHistory)
ledgerRouter.post('/', authMiddleware, addLedgerEntry)
ledgerRouter.delete('/bulk', authMiddleware, deleteMultipleLedgerEntries)
ledgerRouter.delete('/:id', authMiddleware, deleteLedgerEntry)

export default ledgerRouter;