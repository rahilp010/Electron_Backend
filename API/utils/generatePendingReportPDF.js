import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const generatePendingReportPDF = async (html, fileName) => {
    const browser = await puppeteer.launch({
        headless: 'new',
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const dir = path.join(os.tmpdir(), 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    const filePath = path.join(dir, fileName);

    await page.pdf({
        path: filePath,
        format: 'A4',
        printBackground: true,
        margin: {
            top: '12mm',
            bottom: '12mm',
            left: '12mm',
            right: '12mm',
        },
    });

    await browser.close();
    return filePath;
};
