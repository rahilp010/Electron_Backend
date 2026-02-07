import express from 'express'
import Sales from '../sales/salesSchema.js';
import Purchase from '../purchase/purchaseSchema.js';

export const getPendingCollections = async (req, res) => {
    try {
        const sales = await Sales.find({
            pendingAmount: { $gt: 0 },
        }).populate('clientId');

        const totalPending = sales.reduce(
            (sum, s) => sum + (s.pendingAmount || 0),
            0
        );

        res.json({
            totalPending,
            count: sales.length,
            list: sales.map(s => ({
                id: s._id,
                clientId: s.clientId,
                clientName: s.clientId?.clientName || 'N/A',
                pendingAmount: s.pendingAmount,
                totalAmountWithTax: s.totalAmountWithTax,
                totalAmountWithoutTax: s.totalAmountWithoutTax,
                paymentMethod: s.paymentMethod,
                dueDate: s.dueDate,
                date: s.createdAt,
            })),
        });
    } catch (e) {
        res.status(500).json({ message: 'Failed to load pending collections' });
    }
};


export const getPendingPayments = async (req, res) => {
    try {
        const purchases = await Purchase.find({
            pendingAmount: { $gt: 0 },
        }).populate('clientId');

        const totalPending = purchases.reduce(
            (sum, p) => sum + (p.pendingAmount || 0),
            0
        );

        res.json({
            totalPending,
            count: purchases.length,
            list: purchases.map(p => ({
                id: p._id,
                clientId: p.clientId,
                vendorName: p.clientId?.clientName || 'N/A',
                pendingAmount: p.pendingAmount,
                totalAmountWithTax: p.totalAmountWithTax,
                totalAmountWithoutTax: p.totalAmountWithoutTax,
                paymentMethod: p.paymentMethod,
                dueDate: p.dueDate,
                date: p.createdAt,
            })),
        });
    } catch (e) {
        res.status(500).json({ message: 'Failed to load pending payments' });
    }
};


const pendingReport = express.Router()

pendingReport.get('/pendingCollection', getPendingCollections)
pendingReport.get('/pendingPayment', getPendingPayments)

export default pendingReport