import express from 'express'
import { addLedgerEntry, deleteLedgerEntry, getLedgerByAccount, getClientLedger, getTransferHistory, deleteMultipleLedgerEntries } from './ledgerController.js'

const ledgerRouter = express.Router()

ledgerRouter.get('/', getLedgerByAccount)
ledgerRouter.get('/client/:clientId', getClientLedger)
ledgerRouter.get('/history', getTransferHistory)
ledgerRouter.post('/', addLedgerEntry)
ledgerRouter.delete('/bulk', deleteMultipleLedgerEntries)
ledgerRouter.delete('/:id', deleteLedgerEntry)

export default ledgerRouter;