export type HistorySlipPrintLabels = {
  docTitle: string;
  docTitleEn: string;
  shop: string;
  date: string;
  docNo: string;
  recorder: string;
  savedAt: string;
  updatedBy: string;
  updatedAt: string;
  note: string;
  colNo: string;
  colProduct: string;
  colUnit: string;
  colQty: string;
  colValue: string;
  colUnitPrice: string;
  receivedCount: string;
  totalWon: string;
};

export type HistorySlipPrintLine = {
  index: number;
  product: string;
  productSub?: string;
  unit: string;
  qty: string;
  total: string;
  unitPrice: string;
};

export type HistorySlipPrintPayload = {
  brandName: string;
  heading: string;
  shopName: string;
  dateText: string;
  docNoText: string;
  recorderText: string;
  savedAtText: string;
  updatedByText?: string;
  updatedAtText?: string;
  noteText?: string;
  lines: HistorySlipPrintLine[];
  receivedCount: number;
  totalText: string;
  labels: HistorySlipPrintLabels;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildHistorySlipPrintHtml(payload: HistorySlipPrintPayload): string {
  const L = payload.labels;
  const rows = payload.lines
    .map(
      (line) => `
    <tr>
      <td class="c">${line.index}</td>
      <td class="l">
        <div class="p">${escapeHtml(line.product)}</div>
        ${line.productSub ? `<div class="sub">${escapeHtml(line.productSub)}</div>` : ""}
      </td>
      <td>${escapeHtml(line.unit)}</td>
      <td class="n">${escapeHtml(line.qty)}</td>
      <td class="n">${escapeHtml(line.total)}</td>
      <td class="n">${escapeHtml(line.unitPrice)}</td>
    </tr>`
    )
    .join("");

  const noteBlock = payload.noteText?.trim()
    ? `<p class="note"><strong>${escapeHtml(L.note)}:</strong> ${escapeHtml(payload.noteText.trim())}</p>`
    : "";

  const updatedByBlock = payload.updatedByText?.trim()
    ? `<dt>${escapeHtml(L.updatedBy)}</dt><dd>${escapeHtml(payload.updatedByText.trim())}</dd>`
    : "";
  const updatedAtBlock = payload.updatedAtText?.trim()
    ? `<dt>${escapeHtml(L.updatedAt)}</dt><dd>${escapeHtml(payload.updatedAtText.trim())}</dd>`
    : "";

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(payload.heading)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: "Sarabun", "Noto Sans Thai", system-ui, sans-serif;
      color: #1a2340;
      margin: 0;
      padding: 16px 18px 24px;
      font-size: 13px;
      line-height: 1.45;
    }
    .brand { font-size: 11px; color: #5a6a99; margin: 0 0 2px; }
    h1 { margin: 0 0 2px; font-size: 20px; font-weight: 800; color: #1a3a6b; }
    .en { margin: 0 0 14px; font-size: 11px; letter-spacing: 0.06em; color: #64748b; }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px 20px;
      margin-bottom: 14px;
      padding: 10px 12px;
      border: 1px solid #ddeaff;
      border-radius: 8px;
      background: #f8fafc;
    }
    .meta-grid dt { margin: 0; font-size: 11px; color: #64748b; font-weight: 600; }
    .meta-grid dd { margin: 0 0 6px; font-weight: 700; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    th, td {
      border: 1px solid #c5d9f7;
      padding: 6px 8px;
      vertical-align: top;
    }
    th {
      background: #1a3a6b;
      color: #fff;
      font-weight: 700;
      text-align: left;
    }
    th.n, td.n { text-align: right; white-space: nowrap; }
    th.c, td.c { text-align: center; width: 32px; }
    tr:nth-child(even) td { background: #f5fcf7; }
    .p { font-weight: 700; }
    .sub { font-size: 11px; color: #64748b; margin-top: 2px; }
    .summary {
      margin-top: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 12px;
      flex-wrap: wrap;
    }
    .summary .count { font-size: 12px; color: #475569; }
    .summary .total {
      font-family: ui-monospace, monospace;
      font-size: 20px;
      font-weight: 800;
      color: #1b8a4a;
    }
    .note { margin-top: 10px; font-size: 12px; }
    @media print {
      body { padding: 8mm 10mm; }
      @page { margin: 12mm; size: A4 portrait; }
    }
  </style>
</head>
<body>
  <p class="brand">${escapeHtml(payload.brandName)}</p>
  <h1>${escapeHtml(L.docTitle)}</h1>
  <p class="en">${escapeHtml(L.docTitleEn)}</p>
  <dl class="meta-grid">
    <dt>${escapeHtml(L.shop)}</dt><dd>${escapeHtml(payload.shopName)}</dd>
    <dt>${escapeHtml(L.docNo)}</dt><dd>${escapeHtml(payload.docNoText)}</dd>
    <dt>${escapeHtml(L.date)}</dt><dd>${escapeHtml(payload.dateText)}</dd>
    <dt>${escapeHtml(L.recorder)}</dt><dd>${escapeHtml(payload.recorderText)}</dd>
    <dt>${escapeHtml(L.savedAt)}</dt><dd>${escapeHtml(payload.savedAtText)}</dd>
    ${updatedByBlock}
    ${updatedAtBlock}
  </dl>
  <table>
    <thead>
      <tr>
        <th class="c">${escapeHtml(L.colNo)}</th>
        <th>${escapeHtml(L.colProduct)}</th>
        <th>${escapeHtml(L.colUnit)}</th>
        <th class="n">${escapeHtml(L.colQty)}</th>
        <th class="n">${escapeHtml(L.colValue)}</th>
        <th class="n">${escapeHtml(L.colUnitPrice)}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="summary">
    <div class="count">${escapeHtml(L.receivedCount)}: <strong>${payload.receivedCount}</strong></div>
    <div class="total">${escapeHtml(L.totalWon)} ${escapeHtml(payload.totalText)}</div>
  </div>
  ${noteBlock}
</body>
</html>`;
}

function printViaHiddenFrame(html: string): boolean {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "print");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!doc) {
    iframe.remove();
    return false;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const runPrint = () => {
    try {
      win?.focus();
      win?.print();
    } catch {
      /* ignore */
    }
    window.setTimeout(() => iframe.remove(), 800);
  };

  window.setTimeout(runPrint, 350);
  return true;
}

/** เปิดหน้าพิมพ์ — ในเบราว์เซอร์เลือก「บันทึกเป็น PDF」ได้ (รองรับมือถือด้วย iframe) */
export function openHistorySlipPrintDocument(html: string): boolean {
  if (typeof window === "undefined") return false;

  try {
    const win = window.open("", "_blank");
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      window.setTimeout(() => {
        try {
          win.print();
        } catch {
          printViaHiddenFrame(html);
        }
      }, 400);
      return true;
    }
  } catch {
    /* popup blocked */
  }

  return printViaHiddenFrame(html);
}
