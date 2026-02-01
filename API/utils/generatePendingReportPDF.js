// utils/generatePendingReportPDF.js
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export const generatePendingReportPDF = async ({
    title,
    list,
    summary,
}) => {
    const uploadsDir = path.join(process.cwd(), 'uploads');

    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileName = `pending-report-${Date.now()}.pdf`;
    const filePath = path.join(uploadsDir, fileName);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(fs.createWriteStream(filePath));

    /* ===== HEADER ===== */
    doc.fontSize(18).font('Helvetica-Bold').text('Envy ERP', {
        align: 'center',
    });

    doc
        .moveDown(0.5)
        .fontSize(14)
        .font('Helvetica')
        .text(title, { align: 'center' });

    doc.moveDown(1);

    /* ===== SUMMARY ===== */
    doc.fontSize(12);
    doc.text(`Total Pending Amount : ₹ ${summary.totalPending}`);
    doc.text(`Overdue (>30 days)   : ₹ ${summary.overdueAmount}`);
    doc.text(`Total Parties        : ${summary.count}`);
    doc.moveDown(1);

    /* ===== TABLE ===== */
    doc.font('Helvetica-Bold');
    doc.text('Party', 40);
    doc.text('Date', 180);
    doc.text('Pending', 260);
    doc.text('Method', 350);
    doc.text('Due Date', 440);
    doc.moveDown(0.4);

    doc.font('Helvetica');

    list.forEach(item => {
        doc.text(item.name, 40);
        doc.text(
            new Date(item.date).toLocaleDateString('en-IN'),
            180,
        );
        doc.text(`₹ ${item.pendingAmount}`, 260);
        doc.text(item.paymentMethod || '-', 350);
        doc.text(
            item.dueDate
                ? new Date(item.dueDate).toLocaleDateString('en-IN')
                : '-',
            440,
        );
        doc.moveDown(0.4);
    });

    doc
        .moveDown(2)
        .fontSize(10)
        .text(
            `Generated on ${new Date().toLocaleString('en-IN')}`,
            { align: 'center' },
        );

    doc.end();

    return fileName; // ✅ ONLY filename
};
