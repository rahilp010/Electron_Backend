const templateHTML = ({ type, data, summary, client }) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  @page {
    size: A4;
    margin: 0;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    padding: 40px 20px;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: #111827; 
    background: #fff;
    padding-bottom: 100px; /* Space for footer */
  }

  /* === HEADER === */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 45px;
  }

  .brand-logo {
    font-size: 32px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: -1px;
    color: #111827;
    line-height: 1;
  }
  .brand-sub {
    font-size: 11px;
    color: #6b7280;
    font-weight: 500;
    margin-top: 6px;
    letter-spacing: 2px;
  }

  .report-type {
    text-align: right;
  }
  .report-title {
    font-size: 30px;
    font-weight: 400;
    color: #374151;
  }
  .report-id {
    font-size: 13px;
    color: #9ca3af;
    margin-top: 4px;
  }

  /* === BILL TO INFO === */
  .info-section {
    display: flex;
    justify-content: space-between;
    margin-bottom: 35px;
  }
  
  .label {
    font-size: 11px;
    font-weight: 700;
    color: #9ca3af; 
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
  }
  
  .value {
    font-size: 16px;
    font-weight: 600;
    color: #111827;
  }
  
  .value-sub {
    font-size: 13px;
    color: #6b7280;
    margin-top: 2px;
  }

  /* === PREMIUM DARK BAR === */
  .status-bar {
    background-color: #0f172a; 
    color: #ffffff;
    padding: 28px 50px;
    margin: 0 -50px 45px -50px; 
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .status-item {
    display: flex;
    flex-direction: column;
  }

  .status-label {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #94a3b8;
    margin-bottom: 8px;
  }

  .status-value {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.5px;
  }

  /* === TABLE === */
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 45px;
  }

  th {
    text-align: left;
    padding: 14px 0;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    color: #6b7280;
    border-bottom: 2px solid #e5e7eb;
  }

  td {
    padding: 18px 0;
    border-bottom: 1px solid #f3f4f6;
    color: #374151;
    font-size: 15px;
  }

  .right {
    text-align: right;
  }
  
  .mono {
    font-family: 'Courier New', Courier, monospace;
    color: #4b5563;
    font-weight: 600;
  }

  /* === TOTALS SECTION === */
  .summary-section {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 50px;
  }

  .summary-box {
    width: 320px;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid #f3f4f6;
  }

  .summary-label {
    font-size: 14px;
    font-weight: 500;
    color: #6b7280;
  }

  .summary-val {
    font-size: 15px;
    font-weight: 600;
    color: #111827;
  }

  .total-row {
    display: flex;
    justify-content: space-between;
    padding-top: 18px;
    margin-top: 5px;
    border-bottom: none;
    align-items: flex-end;
  }

  .total-label {
    font-size: 16px;
    font-weight: 600;
    color: #111827;
  }

  .total-val {
    font-size: 26px;
    font-weight: 800;
    color: #111827;
  }

  /* === BANK INFO & SIGNATURE ROW === */
  .bottom-row {
    display: flex;
    justify-content: space-between;
    page-break-inside: avoid;
    margin-top: 20px;
  }

  .terms-box {
    width: 55%;
  }

  .section-head {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    color: #111827;
    margin-bottom: 8px;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 4px;
    display: inline-block;
  }

  .text-block {
    font-size: 12px;
    color: #4b5563;
    line-height: 1.6;
    margin-bottom: 20px;
  }

  .sign-box {
    width: 35%;
    text-align: center;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }

  .sign-space {
    height: 70px; /* Space for physical signature */
  }

  .sign-line {
    border-top: 2px solid #111827;
    padding-top: 8px;
    font-size: 13px;
    font-weight: 700;
    color: #111827;
  }

  .for-company {
    font-size: 12px;
    color: #6b7280;
    margin-bottom: auto;
    text-align: right;
    font-style: italic;
  }

  /* === FOOTER === */
  .footer {
    margin-top:80px;
    bottom: 40px;
    left: 50px;
    right: 50px;
    text-align: center;
    border-top: 1px solid #e5e7eb;
    padding-top: 20px;
  }
  .footer-text {
    font-size: 11px;
    color: #9ca3af;
  }
  .brand-mark {
    color: #d1d5db;
    font-weight: 900;
    font-size: 13px;
    margin-bottom: 4px;
  }

</style>
</head>

<body>

  <div class="header">
    <div>
      <div class="brand-logo">Envy</div>
      <div class="brand-sub">FINANCE MANAGEMENT</div>
      <div class="report-id">GENERATED ON ${new Date().toLocaleDateString()}</div>
    </div>
    <div class="report-type">
      <div class="report-title">
        ${type === 'collection' ? 'Receivables' : 'Payables'}
      </div>
      
    </div>
  </div>

  <div class="info-section">
    <div>
      <div class="label">Bill To</div>
      <div class="value">${client?.clientName || 'All Clients'}</div>
      <div class="value-sub">${client?.accountNumber ? `ACCT: ${client.accountNumber}` : ''}</div>
    </div>
    <div style="text-align: right;">
      <div class="label">Total Parties</div>
      <div class="value">${summary.totalParties}</div>
    </div>
  </div>

  <div class="status-bar">
    <div class="status-item">
      <div class="status-label">Total Amount Pending</div>
      <div class="status-value">₹ ${summary.totalAmount.toLocaleString('en-IN')}</div>
    </div>
    <div class="status-item" style="text-align: right;">
      <div class="status-label">Report Date</div>
      <div class="status-value">${new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 40%">${type === 'collection' ? 'Client' : 'Vendor'} Name</th>
        <th style="width: 30%">Transaction Date</th>
        <th class="right" style="width: 30%">Pending Amount</th>
      </tr>
    </thead>
    <tbody>
      ${data.length === 0
        ? `<tr><td colspan="3" style="text-align:center; padding: 30px; color: #9ca3af;">No pending records found</td></tr>`
        : data.map(i => `
            <tr>
              <td>
                <div style="font-weight: 600;">${type === 'collection' ? i.clientName : i.vendorName}</div>
              </td>
              <td>${new Date(i.date).toLocaleDateString()}</td>
              <td class="right">₹ ${i.pendingAmount.toLocaleString('en-IN')}</td>
            </tr>
          `).join('')
    }
    </tbody>
  </table>

  <div class="summary-section">
    <div class="summary-box">
      <div class="summary-row">
        <div class="summary-label">Subtotal</div>
        <div class="summary-val">₹ ${summary.totalAmount.toLocaleString('en-IN')}</div>
      </div>
      <div class="summary-row">
        <div class="summary-label">Overdue (>30 Days)</div>
        <div class="summary-val" style="color: #dc2626;">₹ ${summary.overdueAmount.toLocaleString('en-IN')}</div>
      </div>
      <div class="total-row">
        <div class="total-label">Total Due</div>
        <div class="total-val">₹ ${summary.totalAmount.toLocaleString('en-IN')}</div>
      </div>
    </div>
  </div>

  <div class="bottom-row">
    
    <div class="terms-box">
      <div class="section-head">Bank Details</div>
      <div class="text-block">
        Bank Name: <strong>HDFC Bank</strong><br/>
        Account No: <strong>XXXX-XXXX-1234</strong><br/>
        IFSC Code: <strong>HDFC000123</strong><br/>
        Branch: Mumbai Main
      </div>

      <div class="section-head">Terms & Conditions</div>
      <div class="text-block">
        1. Payment is due within 30 days of invoice date.<br/>
        2. Please quote the invoice number in your transfer description.<br/>
        3. Interest of 2% per month will be charged on overdue payments.
      </div>
    </div>

    <div class="sign-box">
      <div class="for-company">For Envy Finance Management</div>
      <div class="sign-space">
        </div>
      <div class="sign-line">Authorized Signatory</div>
    </div>

  </div>

  <div class="footer">
    <div class="brand-mark">ENVY</div>
    <div class="footer-text">This is a system generated report.</div>
  </div>

</body>
</html>
`;

export default templateHTML;