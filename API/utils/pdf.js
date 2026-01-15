import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import Sales from '../sales/salesSchema.js';
import express from 'express';

export const exportSalesPDF = async (req, res) => {
    try {
        const sales = await Sales.find({}).populate('clientId productId');

        const doc = new PDFDocument({ margin: 30 });
        const buffers = [];

        // 🔥 Collect PDF chunks
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            const pdfData = Buffer.concat(buffers);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader(
                'Content-Disposition',
                'attachment; filename="sales-report.pdf"',
            );
            res.setHeader('Content-Length', pdfData.length);

            res.end(pdfData);
        });

        // ===== PDF CONTENT =====
        doc.fontSize(18).text('Sales Report', { align: 'center' });
        doc.moveDown();

        sales.forEach(s => {
            doc
                .fontSize(10)
                .text(
                    `${s.clientId?.clientName || 'N/A'} | ${s.productId?.productName || 'N/A'
                    } | ₹${s.totalAmountWithTax}`,
                );
        });

        doc.end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to generate PDF' });
    }
};

export const exportSalesExcel = async (req, res) => {
    const sales = await Sales.find({}).populate('clientId productId');

    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Sales');

    sheet.columns = [
        { header: 'Client', key: 'client' },
        { header: 'Product', key: 'product' },
        { header: 'Total', key: 'total' },
    ];

    sales.forEach(s =>
        sheet.addRow({
            client: s.clientId?.clientName,
            product: s.productId?.productName,
            total: s.totalAmountWithTax,
        }),
    );

    res.setHeader(
        'Content-Disposition',
        'attachment; filename=sales-report.xlsx',
    );
    await wb.xlsx.write(res);
    res.end();
};

const openSalesPDFRouter = express.Router()

openSalesPDFRouter.get('/', exportSalesPDF)
openSalesPDFRouter.get('/excel', exportSalesExcel)

export default openSalesPDFRouter

