import express from 'express'
import { generatePendingReportPDF } from './generatePendingReportPDF.js';
import templateHTML from './templateHTML.js';

export const exportPendingReportPDF = async (req, res) => {
    try {
        const html = templateHTML(req.body);
        const fileName = `pending-report-${Date.now()}.pdf`;

        const pdfPath = await generatePendingReportPDF(html, fileName);

        res.download(pdfPath);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'PDF generation failed' });
    }
};

const reportRouter = express.Router()

reportRouter.post('/pending', exportPendingReportPDF)
export default reportRouter