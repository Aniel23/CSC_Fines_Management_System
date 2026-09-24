export type ParsedStudentCsvRow = {
  student_id: string;
  name: string;
  age: string;
  gender: string;
  department: string;
  address: string;
};

function normalizeCsvValue(value: string | undefined) {
  return (value ?? '').trim();
}

function parseCsvRows(csvText: string) {
  const rows: string[][] = [];
  let row: string[] = [];
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
      if (!rowLooksLikeBlank(row)) rows.push(row);
      row = [];
    } else {
      current += char;
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    if (!rowLooksLikeBlank(row)) rows.push(row);
  }

  return rows;
}

function isNumberingRow(row: string[]) {
  const nonEmpty = row.filter((cell) => normalizeCsvValue(cell) !== '');
  if (nonEmpty.length === 0) return true;
  if (nonEmpty.length !== 1) return false;
  return /^\d+$/.test(normalizeCsvValue(nonEmpty[0]));
}

function rowLooksLikeBlank(row: string[]) {
  return row.every((cell) => normalizeCsvValue(cell) === '') || isNumberingRow(row);
}

function looksLikeHeaderRow(row: string[]) {
  const lower = row.map((cell) => cell.toLowerCase().trim());
  return lower.some((value) => ['student_id', 'id number', 'no', 'no.', 'name', 'age', 'gender', 'sex', 'department', 'address'].includes(value));
}

function normalizeStudentId(value: string) {
  const compact = normalizeCsvValue(value).replace(/\s+/g, '');
  const match = compact.match(/^(\d{4})[-\s]?(\d{4,5})$/);
  if (!match) return compact;
  return `${match[1]}-${match[2]}`;
}

function isLikelyStudentId(value: string) {
  const normalized = normalizeStudentId(value);
  return /^\d{4}-\d{4,5}$/.test(normalized);
}

function extractGender(raw: string | undefined) {
  const value = normalizeCsvValue(raw).toLowerCase();
  if (value.startsWith('f')) return 'Female';
  if (value.startsWith('m')) return 'Male';
  return 'Other';
}

function isTitleRow(row: string[]) {
  const text = row
    .map((cell) => normalizeCsvValue(cell).toLowerCase())
    .join(' ');

  return text.includes('enrollment') || text.includes('first semester') || text.includes('bpa') || text.includes('year') || text.includes('no.') || text.includes('remarks') || text.includes('date');
}

export function parseStudentCsvRecords(csvText: string, defaultDepartment?: string) {
  const rows = parseCsvRows(csvText);

  if (rows.length === 0) {
    return { header: [], records: [] as ParsedStudentCsvRow[] };
  }

  let header: string[] = [];
  let dataRows = rows;

  const headerIndex = rows.findIndex((row) => looksLikeHeaderRow(row));
  if (headerIndex >= 0) {
    header = rows[headerIndex].map((value) => value.toLowerCase().trim());
    dataRows = rows.slice(headerIndex + 1);
  }

  const records: ParsedStudentCsvRow[] = dataRows
    .map((row) => {
      if (isTitleRow(row)) return null;

      if (header.length > 0) {
        const map: Record<string, string> = {};
        header.forEach((key, index) => {
          map[key] = row[index] ?? '';
        });

        const studentId = normalizeStudentId(map['student_id'] || map['id number'] || map['id']);
        const name = normalizeCsvValue(map['name']).replace(/\s+/g, ' ');

        if (!isLikelyStudentId(studentId) || !name) return null;

        return {
          student_id: studentId,
          name,
          age: normalizeCsvValue(map['age'] || '18'),
          gender: extractGender(map['gender'] || map['sex']),
          department: normalizeCsvValue(map['department'] || defaultDepartment || '' ) || defaultDepartment || '',
          address: normalizeCsvValue(map['address'])
        };
      }

      const studentId = normalizeStudentId(row[2] || row[1] || row[0]);
      const name = normalizeCsvValue(row[1] || row[0]).replace(/\s+/g, ' ');
      if (!isLikelyStudentId(studentId) || !name) return null;

      return {
        student_id: studentId,
        name,
        age: normalizeCsvValue(row[2] || '18'),
        gender: extractGender(row[4] || row[3]),
        department: defaultDepartment || '',
        address: normalizeCsvValue(row[5] || '')
      };
    })
    .filter((record): record is ParsedStudentCsvRow => Boolean(record));

  const uniqueRecords = new Map<string, ParsedStudentCsvRow>();
  records.forEach((record) => {
    const key = normalizeStudentId(record.student_id).toLowerCase();
    if (!uniqueRecords.has(key)) uniqueRecords.set(key, record);
  });

  return { header, records: Array.from(uniqueRecords.values()) };
}
