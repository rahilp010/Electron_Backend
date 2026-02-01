import express from 'express'
import Sales from '../sales/salesSchema.js';
import Purchase from '../purchase/purchaseSchema.js';
import { generatePendingReportPDF } from './generatePendingReportPDF.js';

export const exportPendingReportPDF = async (req, res) => {
    try {
        const { type, clientId } = req.query;

        const Model = type === 'collection' ? Sales : Purchase;

        const records = await Model.find({
            pendingAmount: { $gt: 0 },
            ...(clientId && { clientId }),
        }).populate('clientId');

        const list = records.map(r => ({
            name: r.clientId?.clientName || 'N/A',
            pendingAmount: r.pendingAmount,
            paymentMethod: r.paymentMethod,
            dueDate: r.dueDate,
            date: r.createdAt,
        }));

        const totalPending = list.reduce(
            (a, b) => a + (b.pendingAmount || 0),
            0,
        );

        const overdueAmount = records
            .filter(r => {
                const days =
                    (Date.now() - new Date(r.createdAt)) /
                    (1000 * 60 * 60 * 24);
                return days > 30;
            })
            .reduce((a, b) => a + (b.pendingAmount || 0), 0);

        const fileName = await generatePendingReportPDF({
            title:
                type === 'collection'
                    ? 'Pending Collection Report'
                    : 'Pending Payment Report',
            list,
            summary: {
                totalPending,
                overdueAmount,
                count: records.length,
            },
        });

        // ✅ THIS IS THE IMPORTANT LINE
        const pdfUrl = `${req.protocol}://${req.get('host')}/uploads/${fileName}`;

        console.log('PDF GENERATED:', pdfUrl);

        res.status(200).json({ pdfUrl });
    } catch (err) {
        console.error('PDF EXPORT ERROR:', err);
        res.status(500).json({ message: 'PDF export failed' });
    }
};

const reportRouter = express.Router()

reportRouter.get('/pending', exportPendingReportPDF)
export default reportRouter