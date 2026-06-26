const HTML2PDF_CDNS = [
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js',
  'https://unpkg.com/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js'
];

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed: ${url}`));
    document.head.appendChild(script);
  });
}

function loadHtml2Pdf() {
  if (window.html2pdf) return Promise.resolve();
  if (window.__html2pdfLoading) return window.__html2pdfLoading;

  window.__html2pdfLoading = (async () => {
    for (const url of HTML2PDF_CDNS) {
      try {
        await loadScript(url);
        if (window.html2pdf) return;
      } catch (_) { /* try next CDN */ }
    }
    throw new Error('לא ניתן לטעון את מחולל ה-PDF');
  })();

  return window.__html2pdfLoading;
}

function isMobileDevice() {
  return /iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent);
}

async function downloadBlob(blob, filename) {
  const type = blob.type || 'application/octet-stream';
  const file = new File([blob], filename, { type });

  if (isMobileDevice() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (_) {
      /* fall through to direct download */
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (isMobileDevice()) {
      setTimeout(() => {
        try {
          window.open(url, '_blank');
        } catch (_) { /* ignore */ }
      }, 400);
    }
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }
}

function openPrintPreview(html, title, downloadName, orientation = 'landscape') {
  const existing = document.getElementById('hen-print-preview');
  if (existing) existing.remove();

  const safeTitle = typeof escapeHtml === 'function' ? escapeHtml(title || 'דוח') : (title || 'דוח');
  const pageSize = orientation === 'portrait' ? 'A4 portrait' : 'A4 landscape';
  const fullHtml = html.includes('<!DOCTYPE')
    ? html
    : `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8"><title>${safeTitle}</title><link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&display=swap" rel="stylesheet"><style>@page{size:${pageSize};margin:10mm}body{margin:0;font-family:'Heebo',Arial,sans-serif;background:#fff}</style></head><body>${html}</body></html>`;

  const wrap = document.createElement('div');
  wrap.id = 'hen-print-preview';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.setAttribute('aria-label', title || 'תצוגה להדפסה');
  wrap.innerHTML = `
    <style>
      #hen-print-preview {
        position: fixed; inset: 0; z-index: 300000;
        background: #f1f5f9; display: flex; flex-direction: column;
      }
      #hen-print-preview-toolbar {
        flex-shrink: 0; display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;
        padding: 12px 16px; background: #1e293b; color: #fff;
        box-shadow: 0 2px 8px rgba(0,0,0,.15);
      }
      #hen-print-preview-toolbar button {
        font-family: inherit; font-size: 15px; font-weight: 600;
        padding: 10px 18px; border: none; border-radius: 8px; cursor: pointer;
      }
      #hen-print-preview-go { background: #4f46e5; color: #fff; }
      #hen-print-preview-pdf { background: #059669; color: #fff; }
      #hen-print-preview-dl { background: #fff; color: #1e293b; }
      #hen-print-preview-close { background: transparent; color: #cbd5e1; border: 1px solid #475569; }
      #hen-print-preview-body {
        flex: 1; overflow: auto; padding: 12px; background: #e2e8f0;
        -webkit-overflow-scrolling: touch;
      }
      #hen-print-preview-sheet {
        max-width: 1100px; margin: 0 auto; background: #fff;
        box-shadow: 0 4px 24px rgba(0,0,0,.12);
      }
      @media print {
        body > *:not(#hen-print-preview) { display: none !important; }
        #hen-print-preview { position: static; inset: auto; background: #fff; display: block; }
        #hen-print-preview-toolbar { display: none !important; }
        #hen-print-preview-body { padding: 0; background: #fff; overflow: visible; }
        #hen-print-preview-sheet { box-shadow: none; max-width: none; margin: 0; }
      }
    </style>
    <div id="hen-print-preview-toolbar">
      <button type="button" id="hen-print-preview-go">הדפס / שמור כ-PDF</button>
      <button type="button" id="hen-print-preview-pdf">הורד PDF</button>
      <button type="button" id="hen-print-preview-dl">הורד HTML</button>
      <button type="button" id="hen-print-preview-close">סגור</button>
    </div>
    <div id="hen-print-preview-body">
      <div id="hen-print-preview-sheet"></div>
    </div>
  `;
  document.body.appendChild(wrap);
  document.body.style.overflow = 'hidden';

  const temp = document.createElement('div');
  temp.innerHTML = fullHtml;
  const bodyEl = temp.querySelector('body');
  const sheet = wrap.querySelector('#hen-print-preview-sheet');
  sheet.innerHTML = bodyEl ? bodyEl.innerHTML : fullHtml;

  const closePreview = () => {
    wrap.remove();
    document.body.style.overflow = '';
  };

  wrap.querySelector('#hen-print-preview-go').onclick = () => window.print();
  wrap.querySelector('#hen-print-preview-close').onclick = closePreview;
  wrap.querySelector('#hen-print-preview-dl').onclick = () => {
    const name = `${downloadName || 'report'}-${new Date().toISOString().split('T')[0]}.html`;
    downloadBlob(new Blob([fullHtml], { type: 'text/html;charset=utf-8' }), name);
    if (typeof showToast === 'function') showToast('קובץ HTML הורד', 'success');
  };
  wrap.querySelector('#hen-print-preview-pdf').onclick = async () => {
    const btn = wrap.querySelector('#hen-print-preview-pdf');
    btn.disabled = true;
    btn.textContent = 'מייצר PDF...';
    try {
      const captureRoot = document.createElement('div');
      captureRoot.innerHTML = sheet.innerHTML;
      captureRoot.style.cssText = 'position:fixed;left:0;top:0;width:1100px;background:#fff;z-index:299999;pointer-events:none';
      document.body.appendChild(captureRoot);
      const el = captureRoot.firstElementChild || captureRoot;
      const fname = `${downloadName || 'report'}-${new Date().toISOString().split('T')[0]}.pdf`;
      await savePdfFromElement(el, { filename: fname, orientation });
      if (typeof showToast === 'function') showToast('הקובץ הורד', 'success');
      captureRoot.remove();
    } catch (err) {
      console.error(err);
      if (typeof showToast === 'function') showToast('לא הצלחנו ליצור PDF — השתמשי ב«הדפס / שמור כ-PDF»', 'info');
    } finally {
      btn.disabled = false;
      btn.textContent = 'הורד PDF';
    }
  };

  if (typeof showToast === 'function') {
    showToast('לחצי «הדפס / שמור כ-PDF» לשמירה', 'info');
  }
}

async function savePdfFromElement(element, {
  filename,
  orientation = 'landscape',
  margin = 8,
  beforeCapture = null
} = {}) {
  await loadHtml2Pdf();
  if (!window.html2pdf) throw new Error('PDF library missing');

  if (document.fonts?.ready) await document.fonts.ready;
  if (beforeCapture) await beforeCapture(element);
  await new Promise(resolve => setTimeout(resolve, 500));

  const captureWidth = Math.max(element.scrollWidth || 0, element.offsetWidth || 0, 794);
  const captureHeight = Math.max(element.scrollHeight || 0, element.offsetHeight || 0, 600);

  const canvas = await html2pdf()
    .set({
      margin: 0,
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        letterRendering: false,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
        width: captureWidth,
        height: captureHeight,
        windowWidth: captureWidth,
        windowHeight: captureHeight
      }
    })
    .from(element)
    .toCanvas()
    .get('canvas');

  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) throw new Error('PDF library missing');

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const contentW = pageW - margin * 2;
  const imgW = contentW;
  const imgH = (canvas.height * imgW) / canvas.width;
  const imgData = canvas.toDataURL('image/jpeg', 0.92);

  let position = margin;
  let heightLeft = imgH;
  pdf.addImage(imgData, 'JPEG', margin, position, imgW, imgH);
  heightLeft -= (pageH - margin * 2);

  while (heightLeft > 0) {
    pdf.addPage();
    position = margin - (imgH - heightLeft);
    pdf.addImage(imgData, 'JPEG', margin, position, imgW, imgH);
    heightLeft -= (pageH - margin * 2);
  }

  await downloadBlob(pdf.output('blob'), filename);
}

async function exportPdfFromHtml({
  html,
  rootSelector,
  filename,
  orientation = 'landscape',
  hostWidth = '277mm',
  beforeCapture = null,
  printFallbackHtml = null,
  printTitle = 'מסמך',
  printDownloadName = 'document',
  printOrientation = 'landscape'
}) {
  let host = null;
  try {
    if (typeof showLoading === 'function') showLoading(true);

    host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = [
      'position:fixed', 'top:0', 'left:0',
      `width:${hostWidth}`, 'background:#fff',
      'z-index:100001', 'overflow:visible',
      'box-sizing:border-box', 'pointer-events:none'
    ].join(';');
    host.innerHTML = html;
    document.body.appendChild(host);

    const element = rootSelector ? host.querySelector(rootSelector) : host.firstElementChild;
    if (!element) throw new Error('PDF element missing');

    await savePdfFromElement(element, {
      filename,
      orientation,
      beforeCapture: beforeCapture ? (el) => beforeCapture(el, host) : null
    });
    if (typeof showToast === 'function') showToast('הקובץ הורד בהצלחה', 'success');
    return true;
  } catch (err) {
    console.error('PDF export error:', err);
    openPrintPreview(
      printFallbackHtml || html,
      printTitle,
      printDownloadName,
      printOrientation
    );
    return false;
  } finally {
    if (host?.parentNode) host.parentNode.removeChild(host);
    if (typeof showLoading === 'function') showLoading(false);
  }
}
