const fs = require('fs');
const csv = fs.readFileSync('c:/Users/Rens_Space.DESKTOP-M98PN4K/Documents/ENROLLMENT DATA - BPA 4.csv', 'utf8');

function normalizeCsvValue(value) { return (value ?? '').trim(); }
function parseCsvRows(csvText) {
  const rows = [];
  let row = [];
  let current = '';
  let inQuotes = false;
  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    if (char === '"') {
      if (inQuotes && csvText[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && csvText[index + 1] === '\n') index += 1;
      row.push(current.trim());
      current = '';
      if (!row.every((cell) => normalizeCsvValue(cell) === '')) rows.push(row);
      row = [];
    } else {
      current += char;
    }
  }
  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    if (!row.every((cell) => normalizeCsvValue(cell) === '')) rows.push(row);
  }
  return rows;
}
function looksLikeHeaderRow(row) {
  const lower = row.map((cell) => cell.toLowerCase().trim());
  return lower.some((value) => ['student_id', 'id number', 'name', 'age', 'gender', 'sex', 'department', 'address'].includes(value));
}
function normalizeStudentId(value) {
  const compact = normalizeCsvValue(value).replace(/\s+/g, '');
  const match = compact.match(/^(\d{4})[-\s]?(\d{4,5})$/);
  if (!match) return compact;
  return `${match[1]}-${match[2]}`;
}
function isLikelyStudentId(value) {
  const normalized = normalizeStudentId(value);
  return /^\d{4}-\d{4,5}$/.test(normalized);
}
function isTitleRow(row) {
  const text = row.map((cell) => normalizeCsvValue(cell).toLowerCase()).join(' ');
  return text.includes('enrollment') || text.includes('first semester') || text.includes('bpa') || text.includes('year') || text.includes('no.') || text.includes('remarks') || text.includes('date');
}
let rows = parseCsvRows(csv);
let header = [];
let dataRows = rows;
const headerIndex = rows.findIndex((row) => looksLikeHeaderRow(row));
if (headerIndex >= 0) {
  header = rows[headerIndex].map((value) => value.toLowerCase().trim());
  dataRows = rows.slice(headerIndex + 1);
}
let accepted = [];
let rejected = [];
for (const [idx, row] of dataRows.entries()) {
  if (isTitleRow(row)) continue;
  const map = {};
  header.forEach((key, index) => { map[key] = row[index] ?? ''; });
  const studentId = normalizeStudentId(map['student_id'] || map['id number'] || map['id']);
  const name = normalizeCsvValue(map['name']).replace(/\s+/g, ' ');
  if (!isLikelyStudentId(studentId) || !name) {
    rejected.push({ idx, studentId, name, row: row.slice(0, 6) });
  } else {
    accepted.push(studentId);
  }
}
console.log(JSON.stringify({ rows: rows.length, headerIndex, accepted: accepted.length, rejected: rejected.length, sampleAccepted: accepted.slice(0, 10), sampleRejected: rejected.slice(0, 12) }, null, 2));
