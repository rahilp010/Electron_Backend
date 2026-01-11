import Client from '../clients/clientSchema.js'
import { calculateTotals } from './calculateTotals.js'

export const updateClientBalances = async (
    clientId,
    tx,
    mode = 'apply'
) => {
    const factor = mode === 'rollback' ? -1 : 1
    const { grandTotal } = calculateTotals(tx)

    let update = {
        paidAmount: 0,
        pendingAmount: 0,
        pendingFromOurs: 0,
    }

    /* ===================== SALES ===================== */
    if (tx.pageName === 'Sales') {
        if (tx.paymentType === 'partial') {
            const paid = Number(tx.paidAmount || 0)
            const pending = Math.max(grandTotal - paid, 0)

            update.paidAmount = factor * paid
            update.pendingAmount = factor * pending

        } else if (tx.statusOfTransaction === 'completed') {
            update.paidAmount = factor * grandTotal

        } else {
            // FULL + PENDING
            update.pendingAmount = factor * grandTotal
        }
    }

    /* ===================== PURCHASE ===================== */
    if (tx.pageName === 'Purchase') {
        if (tx.paymentType === 'partial') {
            const pending = Number(tx.pendingAmount || 0)
            update.pendingFromOurs = factor * pending

        } else if (tx.statusOfTransaction === 'completed') {
            update.paidAmount = factor * grandTotal

        } else {
            // FULL + PENDING
            update.pendingFromOurs = factor * grandTotal
        }
    }

    await Client.updateOne(
        { _id: clientId },
        {
            $inc: {
                paidAmount: update.paidAmount,
                pendingAmount: update.pendingAmount,
                pendingFromOurs: update.pendingFromOurs,
            },
            $set: { updatedAt: new Date() },
        }
    )
}
