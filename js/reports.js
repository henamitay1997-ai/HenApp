const PDF_MONTHS_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

function formatPdfDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00'));
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ב${PDF_MONTHS_HE[d.getMonth()]} ${d.getFullYear()}`;
}

function formatPdfGeneratedDate() {
  const d = new Date();
  return `${d.getDate()} ב${PDF_MONTHS_HE[d.getMonth()]} ${d.getFullYear()}`;
}

function formatPdfGeneratedDateTime() {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${formatPdfGeneratedDate()} בשעה ${h}:${m}`;
}

function formatPdfCurrency(amount) {
  const n = Math.round(Number(amount) || 0);
  return `₪ ${n.toLocaleString('en-US')}`;
}

function pdfAmount(amount) {
  const n = Math.round(Number(amount) || 0);
  return `<span dir="ltr" style="unicode-bidi:isolate;white-space:nowrap;display:inline-block">₪&nbsp;${n.toLocaleString('en-US')}</span>`;
}

/** שומר רווחים בין מילים בעברית ב-PDF (html2canvas) */
function pdfLabel(text) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  return words.map((word, i) =>
    `<span style="display:inline-block${i > 0 ? ';margin-inline-start:0.45em' : ''}">${escapeHtml(word)}</span>`
  ).join('');
}

function pdfBalanceLabel(balance) {
  if (balance > 0) return pdfLabel('שילם יותר מדי');
  if (balance < 0) return pdfLabel('שילם פחות מדי');
  return pdfLabel('מאוזן');
}

function formatPdfMoney(amount) {
  if (amount == null || amount === '') return '';
  const n = Number(amount);
  if (!n || Number.isNaN(n)) return '';
  return `${n} ש"ח`;
}

function formatViolationPenaltyPdf(row) {
  if (!row.penaltyAmount) return 'ללא קנס';
  const amount = formatPdfMoney(row.penaltyAmount);
  if (row.expenseApprovalStatus === 'approved') return `${amount} · אושר`;
  if (row.expenseApprovalStatus === 'rejected') return `${amount} · נדחה`;
  if (row.expenseApprovalStatus === 'pending') return `${amount} · ממתין לאישור`;
  return amount;
}

function getExpenseReportHtml(data, summary) {
  const { parentA, parentB, settlement, rows, total } = summary;
  const parentAName = escapeHtml(parentA.name);
  const parentBName = escapeHtml(parentB.name);
  const generatedDate = formatPdfGeneratedDate();
  const generatedTime = (() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  })();

  const settlementHtml = settlement
    ? `<div style="border:2px solid #1e293b;padding:18px 20px;margin-bottom:20px;text-align:center;background:#fafafa">
        <div style="font-size:12px;color:#64748b;margin-bottom:12px;letter-spacing:0.02em">${pdfLabel('סיכום חוב בין ההורים')}</div>
        <div style="font-size:18px;font-weight:700;margin-bottom:14px;line-height:2.2">
          <span style="font-weight:800">${escapeHtml(settlement.fromName)}</span>
          <span style="display:inline-block;margin:0 0.6em"> חייב/ת ל־ </span>
          <span style="font-weight:800">${escapeHtml(settlement.toName)}</span>
        </div>
        <div style="font-size:12px;color:#64748b;margin-bottom:6px">${pdfLabel('סכום לתשלום')}</div>
        <div style="font-size:30px;font-weight:800;color:#1e293b;line-height:1.3">${pdfAmount(settlement.amount)}</div>
      </div>`
    : `<div style="border:2px solid #166534;padding:14px 20px;margin-bottom:20px;text-align:center;background:#f0fdf4;color:#166534;font-size:15px;font-weight:700;line-height:1.8">
        ${pdfLabel('החשבון מאוזן')} — ${pdfLabel('אין חוב בין ההורים')}
      </div>`;

  const rowsHtml = rows.map((e, i) => {
    const bg = i % 2 === 0 ? '#fff' : '#f8fafc';
    const statusColor = e.paid ? '#166534' : '#92400e';
    const statusText = e.paid ? 'שולם' : 'ממתין לתשלום';
    const splitA = e.splitPercent;
    const splitB = 100 - e.splitPercent;
    return `
      <tr style="background:${bg}">
        <td style="padding:10px 8px;border:1px solid #94a3b8;text-align:right;vertical-align:top">${escapeHtml(e.title || '—')}</td>
        <td style="padding:10px 8px;border:1px solid #94a3b8;text-align:right;vertical-align:top;white-space:nowrap">${escapeHtml(formatPdfDate(e.date))}</td>
        <td style="padding:10px 8px;border:1px solid #94a3b8;text-align:center;vertical-align:top;font-weight:700">${pdfAmount(e.amount)}</td>
        <td style="padding:10px 8px;border:1px solid #94a3b8;text-align:center;vertical-align:top">${escapeHtml(e.paidByName)}</td>
        <td style="padding:10px 8px;border:1px solid #94a3b8;text-align:center;vertical-align:top;font-weight:600">${pdfAmount(e.shareA)}</td>
        <td style="padding:10px 8px;border:1px solid #94a3b8;text-align:center;vertical-align:top;font-weight:600">${pdfAmount(e.shareB)}</td>
        <td style="padding:10px 8px;border:1px solid #94a3b8;text-align:center;vertical-align:top;white-space:nowrap" dir="ltr">${splitA}% / ${splitB}%</td>
        <td style="padding:10px 8px;border:1px solid #94a3b8;text-align:center;vertical-align:top;color:${statusColor};font-weight:600">${statusText}</td>
      </tr>
    `;
  }).join('');

  return `
    <div id="expense-report-pdf" dir="rtl" lang="he" style="
      font-family:'Heebo',Arial,sans-serif;
      color:#0f172a;
      background:#fff;
      width:100%;
      max-width:100%;
      box-sizing:border-box;
      padding:22px 26px;
      line-height:1.7;
      font-size:13px;
      border:2px solid #1e293b;
    ">
      <header style="text-align:center;margin-bottom:22px;padding-bottom:16px;border-bottom:3px double #1e293b">
        <div style="font-size:11px;color:#64748b;margin-bottom:10px;letter-spacing:0.04em">הורים ביחד · מסמך רשמי לתיעוד</div>
        <h1 style="margin:0 0 14px;font-size:22px;font-weight:700;line-height:1.5;letter-spacing:0">דוח הוצאות משותפות</h1>
        <div style="font-size:14px;color:#334155;line-height:2">
          <div>${pdfLabel('שמות ההורים')}: <strong>${parentAName}</strong> · <strong>${parentBName}</strong></div>
          <div style="font-size:12px;color:#64748b;margin-top:4px">
            ${pdfLabel('תאריך הפקה')}: ${generatedDate}
            <span style="display:inline-block;margin:0 0.6em">|</span>
            ${pdfLabel('שעה')}: <span dir="ltr" style="unicode-bidi:isolate">${generatedTime}</span>
          </div>
        </div>
      </header>

      ${settlementHtml}

      <h2 style="font-size:14px;margin:0 0 10px;font-weight:700;border-bottom:2px solid #1e293b;padding-bottom:8px">${pdfLabel('סיכום תשלומים לפי הורה')}</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:22px;font-size:13px">
        <thead>
          <tr style="background:#1e293b;color:#fff">
            <th style="padding:11px 12px;border:1px solid #1e293b;text-align:right;font-weight:700;width:34%">${pdfLabel('סעיף')}</th>
            <th style="padding:11px 12px;border:1px solid #1e293b;text-align:center;font-weight:700;width:33%">${parentAName}</th>
            <th style="padding:11px 12px;border:1px solid #1e293b;text-align:center;font-weight:700;width:33%">${parentBName}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:11px 12px;border:1px solid #94a3b8;text-align:right;background:#f8fafc">${pdfLabel('שולם בפועל')}</td>
            <td style="padding:11px 12px;border:1px solid #94a3b8;text-align:center">${pdfAmount(parentA.paid)}</td>
            <td style="padding:11px 12px;border:1px solid #94a3b8;text-align:center">${pdfAmount(parentB.paid)}</td>
          </tr>
          <tr>
            <td style="padding:11px 12px;border:1px solid #94a3b8;text-align:right;background:#f8fafc">${pdfLabel('חלק לפי אחוזים')}</td>
            <td style="padding:11px 12px;border:1px solid #94a3b8;text-align:center">${pdfAmount(parentA.shouldPay)}</td>
            <td style="padding:11px 12px;border:1px solid #94a3b8;text-align:center">${pdfAmount(parentB.shouldPay)}</td>
          </tr>
          <tr style="background:#fffbeb">
            <td style="padding:11px 12px;border:1px solid #94a3b8;text-align:right;font-weight:700">${pdfLabel('הפרש מהחלק')}</td>
            <td style="padding:11px 12px;border:1px solid #94a3b8;text-align:center;font-weight:700">
              ${parentA.balance === 0 ? '—' : pdfAmount(Math.abs(parentA.balance))}
              ${parentA.balance !== 0 ? `<div style="font-size:11px;color:#64748b;margin-top:4px;font-weight:600">${pdfBalanceLabel(parentA.balance)}</div>` : ''}
            </td>
            <td style="padding:11px 12px;border:1px solid #94a3b8;text-align:center;font-weight:700">
              ${parentB.balance === 0 ? '—' : pdfAmount(Math.abs(parentB.balance))}
              ${parentB.balance !== 0 ? `<div style="font-size:11px;color:#64748b;margin-top:4px;font-weight:600">${pdfBalanceLabel(parentB.balance)}</div>` : ''}
            </td>
          </tr>
        </tbody>
      </table>

      <h2 style="font-size:14px;margin:0 0 10px;font-weight:700;border-bottom:2px solid #1e293b;padding-bottom:8px">${pdfLabel('פירוט הוצאות')}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed">
        <colgroup>
          <col style="width:20%">
          <col style="width:11%">
          <col style="width:10%">
          <col style="width:12%">
          <col style="width:11%">
          <col style="width:11%">
          <col style="width:13%">
          <col style="width:12%">
        </colgroup>
        <thead>
          <tr style="background:#1e293b;color:#fff">
            <th style="padding:10px 8px;border:1px solid #1e293b;text-align:right;font-weight:700">${pdfLabel('תיאור')}</th>
            <th style="padding:10px 8px;border:1px solid #1e293b;text-align:right;font-weight:700">${pdfLabel('תאריך')}</th>
            <th style="padding:10px 8px;border:1px solid #1e293b;text-align:center;font-weight:700">${pdfLabel('סכום')}</th>
            <th style="padding:10px 8px;border:1px solid #1e293b;text-align:center;font-weight:700">${pdfLabel('שולם ע"י')}</th>
            <th style="padding:10px 8px;border:1px solid #1e293b;text-align:center;font-weight:700">${parentAName}</th>
            <th style="padding:10px 8px;border:1px solid #1e293b;text-align:center;font-weight:700">${parentBName}</th>
            <th style="padding:10px 8px;border:1px solid #1e293b;text-align:center;font-weight:700">${pdfLabel('חלוקה')}</th>
            <th style="padding:10px 8px;border:1px solid #1e293b;text-align:center;font-weight:700">${pdfLabel('סטטוס')}</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr style="background:#f1f5f9;font-weight:700">
            <td colspan="2" style="padding:11px 8px;border:1px solid #94a3b8;text-align:right">${pdfLabel('סה"כ')}</td>
            <td style="padding:11px 8px;border:1px solid #94a3b8;text-align:center">${pdfAmount(total)}</td>
            <td style="padding:11px 8px;border:1px solid #94a3b8"></td>
            <td style="padding:11px 8px;border:1px solid #94a3b8;text-align:center">${pdfAmount(parentA.shouldPay)}</td>
            <td style="padding:11px 8px;border:1px solid #94a3b8;text-align:center">${pdfAmount(parentB.shouldPay)}</td>
            <td colspan="2" style="padding:11px 8px;border:1px solid #94a3b8"></td>
          </tr>
        </tfoot>
      </table>

      <footer style="margin-top:20px;padding-top:12px;border-top:1px solid #94a3b8;font-size:10px;color:#64748b;text-align:center;line-height:1.8">
        ${pdfLabel('מסמך זה הופק אוטומטית מאפליקציית הורים ביחד')} · ${pdfLabel('לשימוש פנימי ותיעוד בין ההורים')}
      </footer>
    </div>
  `;
}

async function downloadExpenseReportPdf(data) {
  const summary = calculateExpenseSummary(data);
  if (!summary.rows.length) {
    showToast('אין הוצאות לייצוא');
    return;
  }
  const dateStr = new Date().toISOString().split('T')[0];
  await exportPdfFromHtml({
    html: getExpenseReportHtml(data, summary),
    rootSelector: '#expense-report-pdf',
    filename: `expense-report-${dateStr}.pdf`,
    orientation: 'landscape',
    printFallbackHtml: getExpensePrintDocumentHtml(data, summary),
    printTitle: 'דוח הוצאות משותפות',
    printDownloadName: 'expense-report'
  });
}

function getExpensePrintDocumentHtml(data, summary) {
  const body = getExpenseReportHtml(data, summary);
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>דוח הוצאות משותפות</title>
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body { font-family: 'Heebo', Arial, sans-serif; }
  </style>
</head>
<body>${body}</body>
</html>`;
}

function getViolationsReportHtml(data, rows) {
  const parentA = getParentName(data, 'a');
  const parentB = getParentName(data, 'b');
  const acknowledgedCount = rows.filter(r => r.acknowledged).length;
  const pendingCount = rows.length - acknowledgedCount;
  const totalPenalties = rows.reduce((sum, r) => sum + (Number(r.penaltyAmount) || 0), 0);
  const penaltiesWithAmount = rows.filter(r => r.penaltyAmount).length;

  const rowsHtml = rows.map(r => {
    const dateCell = [formatPdfDate(r.date), r.time].filter(Boolean).join(' · ');
    const details = [r.description, r.location].filter(Boolean).join(' · ');
    const ackDate = r.acknowledgedAt
      ? formatPdfDate(String(r.acknowledgedAt).slice(0, 10))
      : '';
    const ackCell = r.acknowledged
      ? `${r.acknowledgedBy}${ackDate ? ' · ' + ackDate : ''}`
      : 'ממתין לאישור';
    return `
      <tr>
        <td style="padding:10px 8px;border:1px solid #cbd5e1;text-align:right;white-space:nowrap;vertical-align:top">${escapeHtml(dateCell)}</td>
        <td style="padding:10px 8px;border:1px solid #cbd5e1;text-align:right;vertical-align:top">
          <div style="font-weight:700;margin-bottom:4px">${escapeHtml(r.title)}</div>
          ${details ? `<div style="font-size:11px;color:#475569;line-height:1.6">${escapeHtml(details)}</div>` : ''}
          ${r.child && r.child !== '—' ? `<div style="font-size:11px;color:#475569;margin-top:4px">ילד/ה: ${escapeHtml(r.child)}</div>` : ''}
        </td>
        <td style="padding:10px 8px;border:1px solid #cbd5e1;text-align:center;vertical-align:top">${escapeHtml(r.reportedBy)}</td>
        <td style="padding:10px 8px;border:1px solid #cbd5e1;text-align:center;vertical-align:top">${escapeHtml(r.violator)}</td>
        <td style="padding:10px 8px;border:1px solid #cbd5e1;text-align:center;vertical-align:top;font-size:11px;line-height:1.5">${escapeHtml(ackCell)}</td>
        <td style="padding:10px 8px;border:1px solid #cbd5e1;text-align:center;vertical-align:top;white-space:nowrap">${escapeHtml(formatViolationPenaltyPdf(r))}</td>
      </tr>
    `;
  }).join('');

  return `
    <div id="violations-report-pdf" dir="rtl" lang="he" style="
      font-family:'Heebo',Arial,sans-serif;
      color:#0f172a;
      background:#fff;
      width:100%;
      max-width:100%;
      box-sizing:border-box;
      padding:16px;
      line-height:1.75;
      font-size:13px;
      letter-spacing:0;
      word-spacing:normal;
    ">
      <header style="text-align:center;margin-bottom:18px;padding-bottom:14px;border-bottom:3px double #1e293b">
        <div style="font-size:11px;color:#64748b;margin-bottom:8px">דוח רשמי לתיעוד וגיבוי</div>
        <h1 style="margin:0 0 10px;font-size:20px;font-weight:700;line-height:1.5">דוח הפרות זמן משמורת</h1>
        <div style="font-size:13px;color:#334155;line-height:1.7">
          הורים: ${escapeHtml(parentA)} ו${escapeHtml(parentB)}
        </div>
        <div style="font-size:12px;color:#64748b;margin-top:6px">הופק בתאריך ${formatPdfGeneratedDate()}</div>
      </header>

      <table style="width:100%;border-collapse:collapse;margin-bottom:18px;font-size:12px">
        <tr>
          <td style="width:25%;padding:12px;border:1px solid #cbd5e1;background:#f8fafc;text-align:center;vertical-align:top">
            <div style="color:#475569;margin-bottom:6px">סה״כ דיווחים</div>
            <div style="font-size:22px;font-weight:800">${rows.length}</div>
          </td>
          <td style="width:25%;padding:12px;border:1px solid #cbd5e1;background:#f0fdf4;text-align:center;vertical-align:top">
            <div style="color:#166534;margin-bottom:6px">מאושרים</div>
            <div style="font-size:22px;font-weight:800;color:#166534">${acknowledgedCount}</div>
          </td>
          <td style="width:25%;padding:12px;border:1px solid #cbd5e1;background:#fffbeb;text-align:center;vertical-align:top">
            <div style="color:#92400e;margin-bottom:6px">ממתינים לאישור</div>
            <div style="font-size:22px;font-weight:800;color:#92400e">${pendingCount}</div>
          </td>
          <td style="width:25%;padding:12px;border:1px solid #cbd5e1;background:#fef2f2;text-align:center;vertical-align:top">
            <div style="color:#991b1b;margin-bottom:6px">סה״כ קנסות</div>
            <div style="font-size:18px;font-weight:800;color:#991b1b;line-height:1.4">${penaltiesWithAmount ? formatPdfMoney(totalPenalties) : 'ללא'}</div>
          </td>
        </tr>
      </table>

      <h2 style="font-size:14px;margin:0 0 10px;font-weight:700;border-bottom:1px solid #cbd5e1;padding-bottom:6px">פירוט הפרות</h2>
      <table style="width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed">
        <colgroup>
          <col style="width:14%">
          <col style="width:30%">
          <col style="width:12%">
          <col style="width:12%">
          <col style="width:18%">
          <col style="width:14%">
        </colgroup>
        <thead>
          <tr style="background:#f1f5f9">
            <th style="padding:9px 8px;border:1px solid #cbd5e1;text-align:right;font-weight:700">תאריך</th>
            <th style="padding:9px 8px;border:1px solid #cbd5e1;text-align:right;font-weight:700">תיאור האירוע</th>
            <th style="padding:9px 8px;border:1px solid #cbd5e1;text-align:center;font-weight:700">דווח ע״י</th>
            <th style="padding:9px 8px;border:1px solid #cbd5e1;text-align:center;font-weight:700">מפר</th>
            <th style="padding:9px 8px;border:1px solid #cbd5e1;text-align:center;font-weight:700">אישור ההורה השני</th>
            <th style="padding:9px 8px;border:1px solid #cbd5e1;text-align:center;font-weight:700">קנס</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>

      <footer style="margin-top:16px;padding-top:10px;border-top:1px solid #cbd5e1;font-size:10px;color:#64748b;text-align:center;line-height:1.7">
        מסמך תיעוד פנימי — ניתן להדפיס או לשמור לגיבוי
      </footer>
    </div>
  `;
}

function getViolationsPrintDocumentHtml(data, rows) {
  const body = getViolationsReportHtml(data, rows);
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>דוח הפרות משמורת</title>
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body { font-family: 'Heebo', Arial, sans-serif; }
  </style>
</head>
<body>${body}</body>
</html>`;
}

function printViolationsReport(data) {
  const rows = typeof buildViolationsReportRows === 'function'
    ? buildViolationsReportRows(data)
    : [];
  if (!rows.length) {
    showToast('אין דיווחי הפרה להדפסה');
    return;
  }
  const html = getViolationsPrintDocumentHtml(data, rows);
  openPrintPreview(html, 'דוח הפרות משמורת', 'violations-report');
}

function downloadViolationsReportHtml(data) {
  const rows = typeof buildViolationsReportRows === 'function'
    ? buildViolationsReportRows(data)
    : [];
  if (!rows.length) {
    showToast('אין דיווחי הפרה לייצוא');
    return;
  }
  const html = getViolationsPrintDocumentHtml(data, rows);
  const name = `violations-report-${new Date().toISOString().split('T')[0]}.html`;
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), name);
  showToast('הדוח הורד — פתחי את הקובץ והדפיסי ל-PDF', 'success');
}

async function downloadViolationsReportPdf(data) {
  const rows = typeof buildViolationsReportRows === 'function'
    ? buildViolationsReportRows(data)
    : [];
  if (!rows.length) {
    showToast('אין דיווחי הפרה לייצוא');
    return;
  }
  const dateStr = new Date().toISOString().split('T')[0];
  await exportPdfFromHtml({
    html: getViolationsReportHtml(data, rows),
    rootSelector: '#violations-report-pdf',
    filename: `violations-report-${dateStr}.pdf`,
    orientation: 'landscape',
    printFallbackHtml: getViolationsPrintDocumentHtml(data, rows),
    printTitle: 'דוח הפרות משמורת',
    printDownloadName: 'violations-report'
  });
}

function exportViolationsBackupJson(data) {
  const rows = typeof buildViolationsReportRows === 'function'
    ? buildViolationsReportRows(data)
    : [];
  if (!rows.length) {
    showToast('אין דיווחי הפרה לגיבוי');
    return;
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'הורים ביחד',
    reportType: 'custody_violations',
    familyName: data.family?.name || null,
    parentA: getParentName(data, 'a'),
    parentB: getParentName(data, 'b'),
    total: rows.length,
    acknowledged: rows.filter(r => r.acknowledged).length,
    violations: rows
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `violations-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('קובץ הגיבוי הורד', 'success');
}
