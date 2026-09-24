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

  it('keeps quoted names with embedded line breaks in one record', () => {
    const csv = `No.,Name,ID Number,Date,Sex,Remarks\n1,"ABSIN, JANELLE R.\n",2023-0210,Jun-5,F,\n2,"BONADO, JAN ASHLEY R.\n",2023-0188,Jun-5,F,`;

    const { records } = parseStudentCsvRecords(csv, 'BPA-4');

    expect(records).toHaveLength(2);
    expect(records.map((record) => record.student_id)).toEqual(['2023-0210', '2023-0188']);
    expect(records[0].name).toBe('ABSIN, JANELLE R.');
  });

  it('deduplicates student IDs within the same CSV', () => {
    const csv = `Name,ID Number
"FIRST, STUDENT",2023-0210
"DUPLICATE, STUDENT",2023 0210
"SECOND, STUDENT",2023-0188`;

    const { records } = parseStudentCsvRecords(csv, 'BPA-4');

    expect(records).toHaveLength(2);
    expect(records.map((record) => record.student_id)).toEqual(['2023-0210', '2023-0188']);
    expect(records[0].name).toBe('FIRST, STUDENT');
  });

  it('ignores numbered footer rows in enrollment exports and keeps all 40 students', () => {
    const csv = `,,,,,
,,,,,
,,,,,
"ENROLLMENT LIST FOR FIRST SEMESTER, AY. 2026-2027",,,,,
BPA FOURTH YEAR,,,,,
,,,,,
No.,Name,ID Number,Date,Sex,Remarks
1,"ABSIN, JANELLE R. ",2023-0210,Jun-5,F,
2,"BONADO, JAN ASHLEY R. ",2023-0188,Jun-5,F,
3,"BONADO, ROBELYN D. ",2023-0202,Jun-5,F,
4,"BRAÑA, APPLE M.",2023-0223,Jun-5,F,
5,"CAPOTE , PRINCES A. ",2023-0253,Jun-5,F,
6,"CATAPANG , CHRISTINE ROSE F. ",2023-0272,Jun-5,F,
7,"CORONA , ARLYN P. ",2023-0192,Jun-5,F,
8,"CORTEZ, STACY ANNE G. ",2023-0185,Jun-5,F,
9,"DE CLARO, ALEXA JANE C. ",2023-0199,Jun-5,F,
10,"DE LARA, ANGEL ANN M.",2023-0266,Jun-5,F,
11,"DE LEON, LOREBEL A. ",2023-0172,Jun-5,F,
12,"DELA ROSA , ROCELYN P. ",2023-0257,Jun-5,F,
13,"DELA ROSA , RONALYN P.",2023-0256,Jun-5,F,
14,"DORIAS, KRISNAH JOY V. ",2023-0137,Jun-5,F,
15,"GABA. AYESSA JHOEY M. ",2023-0287,Jun-5,F,
16,"GATILO, MARGIE R. ",2023-2027,Jun-5,F,
17,"GAYAO, JASMINE C.",2023- 0296,Jun-5,F,
18,"HERNANDEZ , MIKAELA M. ",2023-0197,Jun-5,F,
19,"LATOGA, VANESSA NICOLE",2023- 0189,Jun-5,F,
20,"MADRIGAL, ALWENA A.",2023-0262,Jun-5,F,
21,"MAGSISI, MARIA ELIZA T. ",2023-0191,Jun-5,F,
22,"MATIRA, CARLA JOY L",2023- 0227,Jun-5,F,
23,"MIRASOL, ALLYSA MAE A. ",2023-0163,Jun-5,F,
24,"NARCA, MANILYN G. ",2023-0247,Jun-5,F,
25,"OJALES, SHARA MAE P. ",2023-0211,Jun-5,F,
26,"RIVAS, GESELLE C. ",2023-0340,Jun-5,F,
27,"SANCHEZ, ANGEL JOY A. ",2023-0184,Jun-5,F,
28,"SARABIA, JAMAICA ROSE M.",2024-0341,Jun-5,F,
29,"VILLAFRANCA , NICOLE A. ",2023-0194,Jun-5,F,
30,"VILLANUEVA, JENNYLYN T.",2023-0203,Jun-5,F,
31,"CARANDAN, JOANN M. ",2023-0228,Jun-25,F,
32,"AMIDO, JOHN LLOYD M. ",2023-0277,Jun-5,M,
33,"BORJA, RENIEL L. ",2023- 0290,Jun-5,M,
34,"CHIQUITO, JOHN CARLO R. ",2023-0179,Jun-5,M,
35,"COMO, JUSTIN S. ",2023-0301,Jun-5,M,
36,"DELOS SANTOS, MOISES G. ",2023-0236,Jun-5,M,
37,"GARCIA, PHILIP F. ",2023-0226,Jun-5,M,
38,"PENAESCOSA, BRYAN A.",2023-0182,Jun-5,M,
39,"RAMOS, JOHN RICK F. ",2023-0297,Jun-25,M,
40,"STO. NIÑO, ANTHONY L. ",2023-0241,Jun-5,M,
41,,,,,
42,,,,,
43,,,,,
44,,,,,
45,,,,,
46,,,,,
47,,,,,
48,,,,,
49,,,,,
50,,,,,
51,,,,,
52,,,,,
53,,,,,
54,,,,,
55,,,,,
56,,,,,
57,,,,,
58,,,,,
59,,,,,
60,,,,,`;

    const { records } = parseStudentCsvRecords(csv, 'BPA-4');

    expect(records).toHaveLength(40);
    expect(records[0].student_id).toBe('2023-0210');
    expect(records[39].student_id).toBe('2023-0241');
  });
});
