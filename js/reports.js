function loadHtml2Pdf() {
  if (window.html2pdf) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('לא ניתן לטעון את מחולל ה-PDF'));
    document.head.appendChild(script);
  });
}

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

function formatPdfMoney(amount) {
  if (amount == null || amount === '') return '';
  const n = Number(amount);
  if (!n || Number.isNaN(n)) return '';
  return `${n.toLocaleString('he-IL')} ש״ח`;
}

function formatViolationPenaltyPdf(row) {
  if (!row.penaltyAmount) return 'ללא קנס';
  const amount = formatPdfMoney(row.penaltyAmount);
  if (row.expenseApprovalStatus === 'approved') return `${amount} · אושר`;
  if (row.expenseApprovalStatus === 'rejected') return `${amount} · נדחה`;
  if (row.expenseApprovalStatus === 'pending') return `${amount} · ממתין לאישור`;
  return amount;
}

function pdfRow(label, value) {
  return `<tr>
    <td style="padding:4px 0;color:#64748b;font-size:12px">${label}</td>
    <td style="padding:4px 0;font-size:12px;font-weight:700;direction:ltr;text-align:left;white-space:nowrap">${escapeHtml(value)}</td>
  </tr>`;
}

function getExpenseReportHtml(data, summary) {
  const { parentA, parentB, settlement, rows, total } = summary;
  const generatedAt = new Date().toLocaleString('he-IL', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  const familyName = data.family?.name || 'המשפחה שלנו';

  const settlementHtml = settlement
    ? `<div style="background:#fffbeb;border:2px solid #fcd34d;border-radius:8px;padding:14px;margin-bottom:16px;text-align:center">
        <div style="font-size:16px;font-weight:700;margin-bottom:6px">
          ${escapeHtml(settlement.fromName)} חייב/ת ל${escapeHtml(settlement.toName)}
        </div>
        <div style="font-size:24px;font-weight:800">${escapeHtml(formatCurrency(settlement.amount))}</div>
      </div>`
    : `<div style="background:#ecfdf5;border:2px solid #86efac;border-radius:8px;padding:14px;margin-bottom:16px;font-weight:700;text-align:center">
        החשבון מאוזן - אין חוב בין ההורים
      </div>`;

  const rowsHtml = rows.map(e => `
    <tr>
      <td style="padding:6px 4px;border-bottom:1px solid #e4e8f0;text-align:right">${escapeHtml(e.title)}</td>
      <td style="padding:6px 4px;border-bottom:1px solid #e4e8f0;text-align:right;white-space:nowrap">${escapeHtml(formatDate(e.date))}</td>
      <td style="padding:6px 4px;border-bottom:1px solid #e4e8f0;text-align:center;font-weight:700;white-space:nowrap">${escapeHtml(formatCurrency(e.amount))}</td>
      <td style="padding:6px 4px;border-bottom:1px solid #e4e8f0;text-align:center">${escapeHtml(e.paidByName)}</td>
      <td style="padding:6px 4px;border-bottom:1px solid #e4e8f0;text-align:center;color:#1d4ed8;white-space:nowrap">${escapeHtml(formatCurrency(e.shareA))}</td>
      <td style="padding:6px 4px;border-bottom:1px solid #e4e8f0;text-align:center;color:#c2410c;white-space:nowrap">${escapeHtml(formatCurrency(e.shareB))}</td>
      <td style="padding:6px 4px;border-bottom:1px solid #e4e8f0;text-align:center;white-space:nowrap">${e.splitPercent}% / ${100 - e.splitPercent}%</td>
      <td style="padding:6px 4px;border-bottom:1px solid #e4e8f0;text-align:center">${e.paid ? 'שולם' : 'ממתין'}</td>
    </tr>
  `).join('');

  return `
    <div id="expense-report-pdf" dir="rtl" style="
      font-family:'Heebo',Arial,sans-serif;
      color:#1a2332;
      padding:16px;
      width:100%;
      max-width:100%;
      box-sizing:border-box;
      background:#fff;
      line-height:1.4;
    ">
      <div style="text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #e4e8f0">
        <div style="font-size:13px;color:#64748b;margin-bottom:4px">הורים ביחד</div>
        <h1 style="margin:0 0 6px;font-size:22px;font-weight:700">דוח הוצאות משותפות</h1>
        <div style="font-size:12px;color:#64748b">${escapeHtml(familyName)} | ${escapeHtml(generatedAt)}</div>
      </div>

      ${settlementHtml}

      <table style="width:100%;border-collapse:separate;border-spacing:10px 0;margin-bottom:16px;table-layout:fixed">
        <tr>
          <td style="width:50%;vertical-align:top;background:#dbeafe;border:2px solid #60a5fa;border-radius:8px;padding:12px">
            <div style="font-weight:800;color:#1e40af;margin-bottom:8px;font-size:14px">${escapeHtml(parentA.name)}</div>
            <table style="width:100%;border-collapse:collapse">
              ${pdfRow('שילם בפועל', formatCurrency(parentA.paid))}
              ${pdfRow('חלקו לפי אחוזים', formatCurrency(parentA.shouldPay))}
              ${pdfRow(parentA.balance >= 0 ? 'שילם יותר מדי' : 'שילם פחות מדי', formatCurrency(Math.abs(parentA.balance)))}
            </table>
          </td>
          <td style="width:50%;vertical-align:top;background:#ffedd5;border:2px solid #fb923c;border-radius:8px;padding:12px">
            <div style="font-weight:800;color:#c2410c;margin-bottom:8px;font-size:14px">${escapeHtml(parentB.name)}</div>
            <table style="width:100%;border-collapse:collapse">
              ${pdfRow('שילם בפועל', formatCurrency(parentB.paid))}
              ${pdfRow('חלקו לפי אחוזים', formatCurrency(parentB.shouldPay))}
              ${pdfRow(parentB.balance >= 0 ? 'שילם יותר מדי' : 'שילם פחות מדי', formatCurrency(Math.abs(parentB.balance)))}
            </table>
          </td>
        </tr>
      </table>

      <h2 style="font-size:15px;margin:0 0 8px;font-weight:700">פירוט הוצאות</h2>
      <table style="width:100%;border-collapse:collapse;font-size:10px;table-layout:fixed">
        <colgroup>
          <col style="width:18%">
          <col style="width:12%">
          <col style="width:10%">
          <col style="width:12%">
          <col style="width:12%">
          <col style="width:12%">
          <col style="width:12%">
          <col style="width:12%">
        </colgroup>
        <thead>
          <tr style="background:#f8f9fc">
            <th style="padding:8px 4px;text-align:right;border-bottom:2px solid #e4e8f0">תיאור</th>
            <th style="padding:8px 4px;text-align:right;border-bottom:2px solid #e4e8f0">תאריך</th>
            <th style="padding:8px 4px;text-align:center;border-bottom:2px solid #e4e8f0">סכום</th>
            <th style="padding:8px 4px;text-align:center;border-bottom:2px solid #e4e8f0">שולם ע"י</th>
            <th style="padding:8px 4px;text-align:center;border-bottom:2px solid #e4e8f0">${escapeHtml(parentA.name)}</th>
            <th style="padding:8px 4px;text-align:center;border-bottom:2px solid #e4e8f0">${escapeHtml(parentB.name)}</th>
            <th style="padding:8px 4px;text-align:center;border-bottom:2px solid #e4e8f0">חלוקה</th>
            <th style="padding:8px 4px;text-align:center;border-bottom:2px solid #e4e8f0">סטטוס</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr style="background:#f8f9fc;font-weight:700">
            <td colspan="2" style="padding:8px 4px;border-top:2px solid #e4e8f0;text-align:right">סה"כ</td>
            <td style="padding:8px 4px;border-top:2px solid #e4e8f0;text-align:center">${escapeHtml(formatCurrency(total))}</td>
            <td style="padding:8px 4px;border-top:2px solid #e4e8f0"></td>
            <td style="padding:8px 4px;border-top:2px solid #e4e8f0;text-align:center;color:#1d4ed8">${escapeHtml(formatCurrency(parentA.shouldPay))}</td>
            <td style="padding:8px 4px;border-top:2px solid #e4e8f0;text-align:center;color:#c2410c">${escapeHtml(formatCurrency(parentB.shouldPay))}</td>
            <td colspan="2" style="padding:8px 4px;border-top:2px solid #e4e8f0"></td>
          </tr>
        </tfoot>
      </table>

      <div style="margin-top:16px;padding-top:10px;border-top:1px solid #e4e8f0;font-size:10px;color:#64748b;text-align:center">
        דוח זה נוצר אוטומטית מאפליקציית הורים ביחד
      </div>
    </div>
  `;
}

async function downloadExpenseReportPdf(data) {
  const summary = calculateExpenseSummary(data);
  if (!summary.rows.length) {
    showToast('אין הוצאות לייצוא');
    return;
  }

  const host = document.createElement('div');
  host.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'width:277mm',
    'background:#fff',
    'z-index:100001',
    'overflow:visible',
    'box-sizing:border-box'
  ].join(';');

  host.innerHTML = getExpenseReportHtml(data, summary);
  document.body.appendChild(host);

  const element = host.querySelector('#expense-report-pdf');
  const dateStr = new Date().toISOString().split('T')[0];

  try {
    showLoading(true);

    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
    await new Promise(resolve => setTimeout(resolve, 400));

    await loadHtml2Pdf();

    const canvasWidth = element.scrollWidth;
    const canvasHeight = element.scrollHeight;

    await html2pdf().set({
      margin: [8, 8, 8, 8],
      filename: `expense-report-${dateStr}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        width: canvasWidth,
        height: canvasHeight,
        windowWidth: canvasWidth,
        windowHeight: canvasHeight
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      pagebreak: { mode: ['css', 'legacy'], avoid: '.pdf-no-break' }
    }).from(element).save();

    showToast('הדוח הורד בהצלחה', 'success');
  } catch (err) {
    console.error(err);
    showToast('שגיאה ביצירת הדוח');
  } finally {
    document.body.removeChild(host);
    showLoading(false);
  }
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
      font-family:'Heebo','David',Arial,sans-serif;
      color:#0f172a;
      background:#fff;
      width:794px;
      max-width:794px;
      box-sizing:border-box;
      padding:12mm 14mm;
      line-height:1.75;
      font-size:13px;
      letter-spacing:0;
      word-spacing:normal;
    ">
      <div style="border:2px solid #1e293b;padding:3mm">
        <div style="outline:1px solid #94a3b8;outline-offset:3px;padding:8mm 7mm">

          <header style="text-align:center;margin-bottom:18px;padding-bottom:14px;border-bottom:3px double #1e293b">
            <div style="font-size:11px;color:#64748b;margin-bottom:8px;letter-spacing:0.06em">דוח רשמי לתיעוד וגיבוי</div>
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
          <table style="width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed">
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
      </div>
    </div>
  `;
}

async function savePdfFromElement(element, { filename, orientation = 'portrait' }) {
  await loadHtml2Pdf();

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
  await new Promise(resolve => setTimeout(resolve, 400));

  const canvasWidth = Math.max(element.scrollWidth || 0, element.offsetWidth || 0, 794);
  const canvasHeight = Math.max(element.scrollHeight || 0, element.offsetHeight || 0, 1123);

  await html2pdf().set({
    margin: [8, 8, 8, 8],
    filename,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      letterRendering: true,
      scrollX: 0,
      scrollY: 0,
      backgroundColor: '#ffffff',
      width: canvasWidth,
      height: canvasHeight,
      windowWidth: canvasWidth,
      windowHeight: canvasHeight
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation },
    pagebreak: { mode: ['css', 'legacy'] }
  }).from(element).save();
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
    @page { size: A4; margin: 10mm; }
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
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) {
    showToast('לא ניתן לפתוח חלון הדפסה — בדקי חסימת חלונות קופצים');
    return;
  }
  win.document.open();
  win.document.write(getViolationsPrintDocumentHtml(data, rows));
  win.document.close();
  win.onload = () => {
    setTimeout(() => {
      win.focus();
      win.print();
    }, 600);
  };
}

async function downloadViolationsReportPdf(data) {
  const rows = typeof buildViolationsReportRows === 'function'
    ? buildViolationsReportRows(data)
    : [];
  if (!rows.length) {
    showToast('אין דיווחי הפרה לייצוא');
    return;
  }

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'width:794px',
    'background:#fff',
    'z-index:100001',
    'overflow:visible',
    'box-sizing:border-box',
    'pointer-events:none'
  ].join(';');

  host.innerHTML = getViolationsReportHtml(data, rows);
  document.body.appendChild(host);

  const element = host.querySelector('#violations-report-pdf');
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `violations-report-${dateStr}.pdf`;

  try {
    showLoading(true);
    element.style.width = '794px';
    element.style.maxWidth = '794px';
    await savePdfFromElement(element, { filename, orientation: 'portrait' });
    showToast('דוח ההפרות הורד בהצלחה', 'success');
  } catch (err) {
    console.error(err);
    showToast('מנסה דרך חלון הדפסה...', 'info');
    printViolationsReport(data);
  } finally {
    if (host.parentNode) host.parentNode.removeChild(host);
    showLoading(false);
  }
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
