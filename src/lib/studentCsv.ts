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

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function rowLooksLikeBlank(row: string[]) {
  return row.every((cell) => normalizeCsvValue(cell) === '');
}

function looksLikeHeaderRow(row: string[]) {
  const lower = row.map((cell) => cell.toLowerCase().trim());
  return lower.some((value) => ['student_id', 'id number', 'name', 'age', 'gender', 'sex', 'department', 'address'].includes(value));
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
  const rows = csvText
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter((row) => row.length > 0)
    .map(parseCsvLine)
    .filter((row) => !rowLooksLikeBlank(row));

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
        const name = normalizeCsvValue(map['name']);

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
      const name = normalizeCsvValue(row[1] || row[0]);
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

  return { header, records };
}
