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

function getExpenseReportHtml(data, summary) {
  const { parentA, parentB, settlement, rows, total } = summary;
  const generatedAt = new Date().toLocaleString('he-IL', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  const familyName = data.family?.name || 'המשפחה שלנו';

  const settlementHtml = settlement
    ? `<div style="background:#fffbeb;border:2px solid #fcd34d;border-radius:8px;padding:16px;margin-bottom:20px">
        <div style="font-size:18px;font-weight:700;margin-bottom:8px">
          ${escapeHtml(settlement.fromName)} חייב/ת ל${escapeHtml(settlement.toName)}
        </div>
        <div style="font-size:28px;font-weight:800;direction:ltr;text-align:right">${escapeHtml(formatCurrency(settlement.amount))}</div>
      </div>`
    : `<div style="background:#ecfdf5;border:2px solid #86efac;border-radius:8px;padding:16px;margin-bottom:20px;font-weight:700">
        החשבון מאוזן — אין חוב בין ההורים
      </div>`;

  const rowsHtml = rows.map(e => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #e4e8f0">${escapeHtml(e.title)}</td>
      <td style="padding:8px;border-bottom:1px solid #e4e8f0;white-space:nowrap">${escapeHtml(formatDate(e.date))}</td>
      <td style="padding:8px;border-bottom:1px solid #e4e8f0;direction:ltr;text-align:left;font-weight:700">${escapeHtml(formatCurrency(e.amount))}</td>
      <td style="padding:8px;border-bottom:1px solid #e4e8f0">${escapeHtml(e.paidByName)}</td>
      <td style="padding:8px;border-bottom:1px solid #e4e8f0;color:#1d4ed8;direction:ltr;text-align:left">${escapeHtml(formatCurrency(e.shareA))}</td>
      <td style="padding:8px;border-bottom:1px solid #e4e8f0;color:#c2410c;direction:ltr;text-align:left">${escapeHtml(formatCurrency(e.shareB))}</td>
      <td style="padding:8px;border-bottom:1px solid #e4e8f0">${e.splitPercent}% / ${100 - e.splitPercent}%</td>
      <td style="padding:8px;border-bottom:1px solid #e4e8f0">${e.paid ? 'שולם' : 'ממתין'}</td>
    </tr>
  `).join('');

  return `
    <div id="expense-report-pdf" dir="rtl" style="font-family:'Heebo',Arial,sans-serif;color:#1a2332;padding:24px;width:750px;background:#fff">
      <div style="text-align:center;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #e4e8f0">
        <div style="font-size:14px;color:#64748b;margin-bottom:4px">הורים ביחד</div>
        <h1 style="margin:0 0 8px;font-size:26px">דוח הוצאות משותפות</h1>
        <div style="font-size:14px;color:#64748b">${escapeHtml(familyName)} · נוצר ב-${escapeHtml(generatedAt)}</div>
      </div>

      ${settlementHtml}

      <div style="display:flex;gap:16px;margin-bottom:24px">
        <div style="flex:1;background:#dbeafe;border:2px solid #60a5fa;border-radius:8px;padding:16px">
          <div style="font-weight:800;color:#1e40af;margin-bottom:12px">${escapeHtml(parentA.name)}</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>שילם בפועל</span><strong style="direction:ltr">${escapeHtml(formatCurrency(parentA.paid))}</strong></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>חלקו לפי אחוזים</span><strong style="direction:ltr">${escapeHtml(formatCurrency(parentA.shouldPay))}</strong></div>
          <div style="display:flex;justify-content:space-between;border-top:2px solid rgba(0,0,0,0.1);padding-top:8px;margin-top:8px">
            <span>${parentA.balance >= 0 ? 'שילם יותר מדי' : 'שילם פחות מדי'}</span>
            <strong style="direction:ltr">${escapeHtml(formatCurrency(Math.abs(parentA.balance)))}</strong>
          </div>
        </div>
        <div style="flex:1;background:#ffedd5;border:2px solid #fb923c;border-radius:8px;padding:16px">
          <div style="font-weight:800;color:#c2410c;margin-bottom:12px">${escapeHtml(parentB.name)}</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>שילם בפועל</span><strong style="direction:ltr">${escapeHtml(formatCurrency(parentB.paid))}</strong></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>חלקו לפי אחוזים</span><strong style="direction:ltr">${escapeHtml(formatCurrency(parentB.shouldPay))}</strong></div>
          <div style="display:flex;justify-content:space-between;border-top:2px solid rgba(0,0,0,0.1);padding-top:8px;margin-top:8px">
            <span>${parentB.balance >= 0 ? 'שילם יותר מדי' : 'שילם פחות מדי'}</span>
            <strong style="direction:ltr">${escapeHtml(formatCurrency(Math.abs(parentB.balance)))}</strong>
          </div>
        </div>
      </div>

      <h2 style="font-size:18px;margin:0 0 12px">פירוט הוצאות</h2>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:#f8f9fc">
            <th style="padding:10px 8px;text-align:right;border-bottom:2px solid #e4e8f0">תיאור</th>
            <th style="padding:10px 8px;text-align:right;border-bottom:2px solid #e4e8f0">תאריך</th>
            <th style="padding:10px 8px;text-align:right;border-bottom:2px solid #e4e8f0">סכום</th>
            <th style="padding:10px 8px;text-align:right;border-bottom:2px solid #e4e8f0">שולם ע"י</th>
            <th style="padding:10px 8px;text-align:right;border-bottom:2px solid #e4e8f0">חלק ${escapeHtml(parentA.name)}</th>
            <th style="padding:10px 8px;text-align:right;border-bottom:2px solid #e4e8f0">חלק ${escapeHtml(parentB.name)}</th>
            <th style="padding:10px 8px;text-align:right;border-bottom:2px solid #e4e8f0">חלוקה</th>
            <th style="padding:10px 8px;text-align:right;border-bottom:2px solid #e4e8f0">סטטוס</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr style="background:#f8f9fc;font-weight:700">
            <td colspan="2" style="padding:10px 8px;border-top:2px solid #e4e8f0">סה"כ</td>
            <td style="padding:10px 8px;border-top:2px solid #e4e8f0;direction:ltr;text-align:left">${escapeHtml(formatCurrency(total))}</td>
            <td style="padding:10px 8px;border-top:2px solid #e4e8f0"></td>
            <td style="padding:10px 8px;border-top:2px solid #e4e8f0;color:#1d4ed8;direction:ltr;text-align:left">${escapeHtml(formatCurrency(parentA.shouldPay))}</td>
            <td style="padding:10px 8px;border-top:2px solid #e4e8f0;color:#c2410c;direction:ltr;text-align:left">${escapeHtml(formatCurrency(parentB.shouldPay))}</td>
            <td colspan="2" style="padding:10px 8px;border-top:2px solid #e4e8f0"></td>
          </tr>
        </tfoot>
      </table>

      <div style="margin-top:24px;padding-top:12px;border-top:1px solid #e4e8f0;font-size:11px;color:#64748b;text-align:center">
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
  host.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1';
  host.innerHTML = getExpenseReportHtml(data, summary);
  document.body.appendChild(host);

  const element = host.querySelector('#expense-report-pdf');
  const dateStr = new Date().toISOString().split('T')[0];

  try {
    showLoading(true);
    await loadHtml2Pdf();
    await html2pdf().set({
      margin: [12, 10, 12, 10],
      filename: `expense-report-${dateStr}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
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
