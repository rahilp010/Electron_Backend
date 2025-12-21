import express from 'express'
import { addLedgerEntry, deleteLedgerEntry, getLedgerByAccount, getClientLedger } from './ladgerController.js'

const ledgerRouter = express.Router()

ledgerRouter.get('/', getLedgerByAccount)
ledgerRouter.get('/client/:clientId', getClientLedger)
ledgerRouter.post('/', addLedgerEntry)
ledgerRouter.delete('/:id', deleteLedgerEntry)

export default ledgerRouter;