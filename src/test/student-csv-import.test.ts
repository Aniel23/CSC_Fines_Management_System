import { describe, it, expect } from 'vitest';
import { parseStudentCsvRecords } from '@/lib/studentCsv';

describe('parseStudentCsvRecords', () => {
  it('accepts enrollment exports with title rows and ID Number/Sex headers', () => {
    const csv = `,,,,,
"ENROLLMENT LIST FOR FIRST SEMESTER, AY. 2026-2027",,,,,
BPA FIRST YEAR,,,,,
No.,Name,ID Number,Date,Sex,Remarks
1,"ABANILLA, NASHRINE V.",2026-0895,Jun-9,F,
2,"AGUHO, CATHERINE V.",2026- 0935,Jun-26,F,
3,"BALAT, MANUEL A.",2026-0891,Jun-9,M,
`;

    const { records } = parseStudentCsvRecords(csv, 'BPA-1');

    expect(records).toHaveLength(3);
    expect(records[0]).toMatchObject({
      student_id: '2026-0895',
      name: 'ABANILLA, NASHRINE V.',
      gender: 'Female',
      department: 'BPA-1'
    });
    expect(records[2]).toMatchObject({
      student_id: '2026-0891',
      name: 'BALAT, MANUEL A.',
      gender: 'Male',
      department: 'BPA-1'
    });
  });

  it('normalizes ID formats accepted by the database', () => {
    const csv = `Name,ID Number
"ABANILLA, NASHRINE V.",2026-0895
"AGUHO, CATHERINE V.",2024-00001
"BALAT, MANUEL A.",2026 0935
`;

    const { records } = parseStudentCsvRecords(csv, 'BPA-1');

    expect(records.map((record) => record.student_id)).toEqual([
      '2026-0895',
      '2024-00001',
      '2026-0935'
    ]);
  });
});
