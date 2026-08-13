import { describe, it, expect } from 'vitest';
import { matchesDepartmentName } from '@/lib/departmentMatching';

describe('matchesDepartmentName', () => {
  it('counts only exact department names, not broader department families', () => {
    expect(matchesDepartmentName('BSIS-1', 'BSIS-1')).toBe(true);
    expect(matchesDepartmentName('BSIS-2', 'BSIS-1')).toBe(false);
    expect(matchesDepartmentName('  BSIS-1  ', 'bsis-1')).toBe(true);
    expect(matchesDepartmentName('BTVTED-CHS-2', 'BTVTED')).toBe(false);
  });
});
