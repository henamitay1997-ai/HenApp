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
  const generatedAt = new Date().toLocaleString('he-IL', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  const familyName = data.family?.name || 'המשפחה שלנו';
  const acknowledgedCount = rows.filter(r => r.acknowledged).length;
  const pendingCount = rows.length - acknowledgedCount;
  const totalPenalties = rows.reduce((sum, r) => sum + (r.penaltyAmount || 0), 0);

  const rowsHtml = rows.map(r => `
    <tr>
      <td style="padding:6px 4px;border-bottom:1px solid #e4e8f0;text-align:right;white-space:nowrap">${escapeHtml(formatDate(r.date))}${r.time ? ' ' + escapeHtml(r.time) : ''}</td>
      <td style="padding:6px 4px;border-bottom:1px solid #e4e8f0;text-align:right">${escapeHtml(r.title)}</td>
      <td style="padding:6px 4px;border-bottom:1px solid #e4e8f0;text-align:center">${escapeHtml(r.reportedBy)}</td>
      <td style="padding:6px 4px;border-bottom:1px solid #e4e8f0;text-align:center">${escapeHtml(r.violator)}</td>
      <td style="padding:6px 4px;border-bottom:1px solid #e4e8f0;text-align:center">${escapeHtml(r.child)}</td>
      <td style="padding:6px 4px;border-bottom:1px solid #e4e8f0;text-align:center">${r.acknowledged ? escapeHtml(r.acknowledgedBy) : 'ממתין'}</td>
      <td style="padding:6px 4px;border-bottom:1px solid #e4e8f0;text-align:center;white-space:nowrap">${escapeHtml(r.penaltyLabel)}</td>
      <td style="padding:6px 4px;border-bottom:1px solid #e4e8f0;text-align:right;font-size:10px">${escapeHtml(r.description || '—')}</td>
    </tr>
  `).join('');

  return `
    <div id="violations-report-pdf" dir="rtl" style="
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
        <h1 style="margin:0 0 6px;font-size:22px;font-weight:700">דוח הפרות זמן משמורת</h1>
        <div style="font-size:12px;color:#64748b">${escapeHtml(familyName)} | ${escapeHtml(generatedAt)}</div>
      </div>

      <table style="width:100%;border-collapse:separate;border-spacing:10px 0;margin-bottom:16px;table-layout:fixed">
        <tr>
          <td style="width:33%;vertical-align:top;background:#fef2f2;border:2px solid #fca5a5;border-radius:8px;padding:12px;text-align:center">
            <div style="font-size:12px;color:#991b1b">סה"כ דיווחים</div>
            <div style="font-size:22px;font-weight:800">${rows.length}</div>
          </td>
          <td style="width:33%;vertical-align:top;background:#ecfdf5;border:2px solid #86efac;border-radius:8px;padding:12px;text-align:center">
            <div style="font-size:12px;color:#166534">מאושרות</div>
            <div style="font-size:22px;font-weight:800">${acknowledgedCount}</div>
          </td>
          <td style="width:33%;vertical-align:top;background:#fffbeb;border:2px solid #fcd34d;border-radius:8px;padding:12px;text-align:center">
            <div style="font-size:12px;color:#92400e">ממתינות / קנסות</div>
            <div style="font-size:22px;font-weight:800">${pendingCount}${totalPenalties ? ' · ' + formatCurrency(totalPenalties) : ''}</div>
          </td>
        </tr>
      </table>

      <h2 style="font-size:15px;margin:0 0 8px;font-weight:700">פירוט הפרות</h2>
      <table style="width:100%;border-collapse:collapse;font-size:10px;table-layout:fixed">
        <colgroup>
          <col style="width:11%">
          <col style="width:14%">
          <col style="width:10%">
          <col style="width:10%">
          <col style="width:9%">
          <col style="width:10%">
          <col style="width:14%">
          <col style="width:22%">
        </colgroup>
        <thead>
          <tr style="background:#f8f9fc">
            <th style="padding:8px 4px;text-align:right;border-bottom:2px solid #e4e8f0">תאריך</th>
            <th style="padding:8px 4px;text-align:right;border-bottom:2px solid #e4e8f0">כותרת</th>
            <th style="padding:8px 4px;text-align:center;border-bottom:2px solid #e4e8f0">דווח ע"י</th>
            <th style="padding:8px 4px;text-align:center;border-bottom:2px solid #e4e8f0">מפר</th>
            <th style="padding:8px 4px;text-align:center;border-bottom:2px solid #e4e8f0">ילד/ה</th>
            <th style="padding:8px 4px;text-align:center;border-bottom:2px solid #e4e8f0">אושר ע"י</th>
            <th style="padding:8px 4px;text-align:center;border-bottom:2px solid #e4e8f0">קנס</th>
            <th style="padding:8px 4px;text-align:right;border-bottom:2px solid #e4e8f0">פרטים</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>

      <div style="margin-top:16px;padding-top:10px;border-top:1px solid #e4e8f0;font-size:10px;color:#64748b;text-align:center">
        דוח גיבוי — נוצר אוטומטית מאפליקציית הורים ביחד
      </div>
    </div>
  `;
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

  host.innerHTML = getViolationsReportHtml(data, rows);
  document.body.appendChild(host);

  const element = host.querySelector('#violations-report-pdf');
  const dateStr = new Date().toISOString().split('T')[0];

  try {
    showLoading(true);
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise(resolve => setTimeout(resolve, 400));
    await loadHtml2Pdf();

    const canvasWidth = element.scrollWidth;
    const canvasHeight = element.scrollHeight;

    await html2pdf().set({
      margin: [8, 8, 8, 8],
      filename: `violations-report-${dateStr}.pdf`,
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
      pagebreak: { mode: ['css', 'legacy'] }
    }).from(element).save();

    showToast('דוח ההפרות הורד בהצלחה', 'success');
  } catch (err) {
    console.error(err);
    showToast('שגיאה ביצירת הדוח');
  } finally {
    document.body.removeChild(host);
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
