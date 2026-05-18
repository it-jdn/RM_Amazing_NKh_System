// ============================================================
//  Amazing Nongkhai — Raw Material System v2.1
//  Code.gs — Google Apps Script Backend
//
//  DB Sheets (RM Amazing Nongkhai - DB):
//    Suppliers   : suppCode | suppName | active
//    Items       : itemCode | itemNameTH | itemNameEN | itemNameKR | mainUnit | subUnit | convertRate
//    Mapping     : suppCode | itemCode | unitPrice
//    Transactions: no | date | suppCode | suppName | itemCode | itemNameTH |
//                  qty | mainUnit | convertRate | subUnit | totalSub |
//                  unitPrice | totalPrice | note | savedAt
// ============================================================

const SS_ID      = '1UfKjL7ySCa55THkaDYrSRNvbXk1T9xZte_7dmTa9Nh0';
const SH_SUPP    = 'Suppliers';
const SH_ITEMS   = 'Items';
const SH_MAP     = 'Mapping';
const SH_TRANS   = 'Transactions';

// ── Entry Point ──────────────────────────────────────────────
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Amazing Nongkhai — ระบบรับวัตถุดิบ')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ── Helpers ──────────────────────────────────────────────────
function getSheet(name) {
  return SpreadsheetApp.openById(SS_ID).getSheetByName(name);
}

function sheetToObjects(sh) {
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h).trim());
  return data.slice(1)
    .filter(row => row.some(c => c !== '' && c !== null && c !== undefined))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
}

// แปลงวันที่ให้เป็น "yyyy-MM-dd" ไม่ว่าจะเป็น Date object หรือ string
function toDateStr(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'Asia/Bangkok', 'yyyy-MM-dd');
  }
  const s = String(val).trim();
  // รองรับ d/m/yyyy
  const dm = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dm) return `${dm[3]}-${dm[2].padStart(2,'0')}-${dm[1].padStart(2,'0')}`;
  // รองรับ yyyy-MM-dd อยู่แล้ว
  return s.substring(0, 10);
}

// ── READ: Initial Data (load on page open) ────────────────────
function getInitialData() {
  try {
    const suppliers = sheetToObjects(getSheet(SH_SUPP))
      .filter(s => String(s.active).toUpperCase() !== 'FALSE')
      .map(s => ({ code: String(s.suppCode), name: String(s.suppName) }));

    const items = sheetToObjects(getSheet(SH_ITEMS))
      .map(i => ({
        code:        String(i.itemCode),
        nameTH:      String(i.itemNameTH  || ''),
        nameEN:      String(i.itemNameEN  || ''),
        nameKR:      String(i.itemNameKR  || ''),
        unit:        String(i.mainUnit    || ''),
        subUnit:     String(i.subUnit     || ''),
        convertRate: parseFloat(i.convertRate) || 1
      }));

    const mapping = sheetToObjects(getSheet(SH_MAP))
      .map(m => ({
        suppCode:  String(m.suppCode),
        itemCode:  String(m.itemCode),
        unitPrice: parseFloat(m.unitPrice) || 0
      }));

    return { success: true, suppliers, items, mapping };
  } catch(err) {
    return { success: false, message: err.message };
  }
}

// ── WRITE: Save Transactions (Operator) ──────────────────────
function saveMultipleTransactions(transactions) {
  try {
    if (!transactions || !transactions.length) return '❌ ไม่มีรายการส่งมา';

    const sh      = getSheet(SH_TRANS);
    const lastRow = sh.getLastRow();
    const savedAt = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');

    // หาเลขลำดับล่าสุด
    let lastNo = 0;
    if (lastRow >= 2) {
      const col = sh.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = col.length - 1; i >= 0; i--) {
        const v = parseFloat(col[i][0]);
        if (!isNaN(v) && v > 0) { lastNo = v; break; }
      }
    }

    const rows = transactions.map(t => {
      lastNo++;
      const qty        = parseFloat(t.qty)        || 0;
      const convert    = parseFloat(t.convertRate) || 1;
      const unitPrice  = parseFloat(t.unitPrice)   || 0;
      const totalPrice = parseFloat(t.totalPrice)  || (qty * unitPrice);
      const totalSub   = Math.round(qty * convert * 100) / 100;
      const calcUP     = qty > 0 ? Math.round((totalPrice / qty) * 100) / 100 : unitPrice;

      return [
        lastNo,
        t.date,
        t.suppCode,
        t.suppName,
        t.itemCode,
        t.itemNameTH,
        qty,
        t.mainUnit,
        convert,
        t.subUnit,
        totalSub,
        calcUP,       // unitPrice ที่คำนวณจาก totalPrice / qty
        totalPrice,
        t.note || '',
        savedAt
      ];
    });

    const insertRow = lastRow + 1;
    sh.getRange(insertRow, 1, rows.length, 15).setValues(rows);
    // format ราคา
    sh.getRange(insertRow, 12, rows.length, 2).setNumberFormat('#,##0.00');

    // อัปเดต unitPrice ใน Mapping ด้วยราคาล่าสุด
    _updateMappingPrices(transactions);

    return `✅ บันทึกสำเร็จ ${rows.length} รายการ (no.${rows[0][0]}–${rows[rows.length-1][0]})`;
  } catch(err) {
    return `❌ Error: ${err.message}`;
  }
}

// อัปเดตราคาล่าสุดกลับไปใน Mapping อัตโนมัติ
function _updateMappingPrices(transactions) {
  try {
    const sh   = getSheet(SH_MAP);
    const data = sh.getDataRange().getValues();
    transactions.forEach(t => {
      if (!t.unitPrice && !t.totalPrice) return;
      const qty       = parseFloat(t.qty) || 0;
      const total     = parseFloat(t.totalPrice) || 0;
      const calcPrice = qty > 0 ? Math.round((total / qty) * 100) / 100 : parseFloat(t.unitPrice) || 0;
      if (calcPrice <= 0) return;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === t.suppCode && String(data[i][1]) === t.itemCode) {
          sh.getRange(i + 1, 3).setValue(calcPrice);
          break;
        }
      }
    });
  } catch(e) { /* ไม่ขัด main flow */ }
}

// ── WRITE: Add Supplier (Admin) ───────────────────────────────
function addSupplier(data) {
  try {
    const sh  = getSheet(SH_SUPP);
    const existing = sheetToObjects(sh).map(s => String(s.suppCode).toUpperCase());
    const code = String(data.suppCode).trim().toUpperCase();
    if (existing.includes(code)) return `❌ รหัส "${code}" มีอยู่แล้ว`;
    sh.appendRow([code, data.suppName.trim(), 'TRUE']);
    return `✅ เพิ่มร้านค้า "${data.suppName}" สำเร็จ`;
  } catch(err) { return `❌ ${err.message}`; }
}

// ── WRITE: Add Item + Mapping (Admin) ─────────────────────────
function addNewItemToSupplier(data) {
  try {
    const shItems = getSheet(SH_ITEMS);
    const shMap   = getSheet(SH_MAP);
    const items   = sheetToObjects(shItems);

    // หา itemCode ถ้าไม่มีให้ generate ใหม่
    let itemCode = String(data.itemCode || '').trim();
    const dup = items.find(i =>
      String(i.itemNameTH).trim().toLowerCase() === String(data.itemNameTH).trim().toLowerCase()
    );

    if (dup) {
      itemCode = String(dup.itemCode);
    } else {
      if (!itemCode) {
        const codes = items.map(i => String(i.itemCode)).filter(c => /^RM\d+$/.test(c));
        const nums  = codes.map(c => parseInt(c.replace('RM', ''), 10)).filter(n => !isNaN(n));
        const next  = nums.length ? Math.max(...nums) + 1 : 1;
        itemCode    = 'RM' + String(next).padStart(5, '0');
      }
      shItems.appendRow([
        itemCode,
        data.itemNameTH || '',
        data.itemNameEN || '',
        data.itemNameKR || '',
        data.mainUnit   || '',
        data.subUnit    || '',
        parseFloat(data.convertRate) || 1
      ]);
    }

    // ตรวจ mapping ซ้ำ
    const maps = sheetToObjects(shMap);
    const dupMap = maps.find(m =>
      String(m.suppCode) === String(data.suppCode) &&
      String(m.itemCode) === itemCode
    );
    if (dupMap) return `⚠️ "${data.itemNameTH}" ผูกกับร้านนี้อยู่แล้ว`;

    shMap.appendRow([data.suppCode, itemCode, parseFloat(data.unitPrice) || 0]);
    return `✅ เพิ่มสินค้า "${data.itemNameTH}" และผูกกับร้านค้าสำเร็จ (${itemCode})`;
  } catch(err) { return `❌ ${err.message}`; }
}

// ── WRITE: Update Unit Price in Mapping (Admin) ───────────────
function updateUnitPrice(suppCode, itemCode, newPrice) {
  try {
    const sh   = getSheet(SH_MAP);
    const data = sh.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === suppCode && String(data[i][1]) === itemCode) {
        sh.getRange(i + 1, 3).setValue(parseFloat(newPrice) || 0);
        return '✅ อัปเดตราคาสำเร็จ';
      }
    }
    return '❌ ไม่พบข้อมูล mapping';
  } catch(err) { return `❌ ${err.message}`; }
}


// ── WRITE: Delete transactions by date+suppCode (for re-save flow) ────────
function deleteTransactionsByDateSupp(date, suppCode) {
  try {
    const sh   = getSheet(SH_TRANS);
    const data = sh.getDataRange().getValues();
    let deleted = 0;
    for (let i = data.length - 1; i >= 1; i--) {
      const rowDate = toDateStr(data[i][1]);
      const rowSupp = String(data[i][2]);
      if (rowDate === date && rowSupp === suppCode) {
        sh.deleteRow(i + 1);
        deleted++;
      }
    }
    return { success: true, deleted };
  } catch(err) {
    return { success: false, message: err.message };
  }
}

// ── READ: Report Data (Manager) ───────────────────────────────
function getReportData(filters) {
  try {
    const trans = sheetToObjects(getSheet(SH_TRANS));

    const filtered = trans.filter(t => {
      const d = toDateStr(t.date);
      if (!d) return false;
      if (filters.dateFrom && d < filters.dateFrom) return false;
      if (filters.dateTo   && d > filters.dateTo)   return false;
      if (filters.suppCode && String(t.suppCode) !== filters.suppCode) return false;
      if (filters.itemCode && String(t.itemCode) !== filters.itemCode) return false;
      return true;
    });

    const totalCost  = filtered.reduce((s, t) => s + (parseFloat(t.totalPrice) || 0), 0);
    const totalTrans = filtered.length;

    // สรุปตามสินค้า
    const byItemMap = {};
    filtered.forEach(t => {
      const k = String(t.itemCode);
      if (!byItemMap[k]) byItemMap[k] = { itemCode: k, itemName: t.itemNameTH, qty: 0, totalPrice: 0, count: 0 };
      byItemMap[k].qty        += parseFloat(t.qty)        || 0;
      byItemMap[k].totalPrice += parseFloat(t.totalPrice) || 0;
      byItemMap[k].count++;
    });

    // แนวโน้มตามวัน
    const byDateMap = {};
    filtered.forEach(t => {
      const d = toDateStr(t.date);
      if (!byDateMap[d]) byDateMap[d] = { date: d, totalPrice: 0, count: 0 };
      byDateMap[d].totalPrice += parseFloat(t.totalPrice) || 0;
      byDateMap[d].count++;
    });

    return {
      success:  true,
      summary:  { totalCost, totalTrans },
      byItem:   Object.values(byItemMap).sort((a, b) => b.totalPrice - a.totalPrice),
      byDate:   Object.values(byDateMap).sort((a, b) => a.date.localeCompare(b.date)),
      rows:     filtered.slice(-300).reverse().map(r => ({...r, date: toDateStr(r.date)}))
    };
  } catch(err) {
    return { success: false, message: err.message };
  }
}

// ── READ: Transactions for History page (lightweight) ────────
function getTransactions() {
  try {
    const sh   = getSheet(SH_TRANS);
    const data = sh.getDataRange().getValues();
    if (data.length < 2) return { success: true, rows: [] };
    const headers = data[0].map(function(h){ return String(h).trim(); });
    var rows = [];
    for (var i = 1; i < data.length; i++) {
      var r = data[i];
      if (!r.some(function(c){ return c !== '' && c !== null && c !== undefined; })) continue;
      var obj = {};
      headers.forEach(function(h, j){ obj[h] = r[j]; });
      rows.push({
        date:       toDateStr(obj['date']),
        suppCode:   String(obj['suppCode']   || ''),
        suppName:   String(obj['suppName']   || ''),
        itemCode:   String(obj['itemCode']   || ''),
        itemNameTH: String(obj['itemNameTH'] || ''),
        qty:        parseFloat(obj['qty'])        || 0,
        mainUnit:   String(obj['mainUnit']   || ''),
        unitPrice:  parseFloat(obj['unitPrice'])  || 0,
        totalPrice: parseFloat(obj['totalPrice']) || 0,
        note:       String(obj['note'] || '')
      });
    }
    return { success: true, rows: rows };
  } catch(err) {
    return { success: false, message: err.message };
  }
}

// ── TEST: ใช้ run ใน Apps Script Editor เพื่อ debug ─────────
function testGetInitialData() {
  var result = getInitialData();
  Logger.log(JSON.stringify(result));
}

function testGetTransactions() {
  var result = getTransactions();
  Logger.log('rows: ' + result.rows.length + ', success: ' + result.success);
}