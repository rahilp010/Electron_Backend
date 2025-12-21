import express from 'express'
import { addLedgerEntry, deleteLedgerEntry, getLedgerByAccount } from './ladgerController.js'

const ledgerRouter = express.Router()

ledgerRouter.get('/', getLedgerByAccount)
ledgerRouter.post('/', addLedgerEntry)
ledgerRouter.put('/:id', deleteLedgerEntry)

export default ledgerRouter;