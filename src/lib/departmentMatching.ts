export function matchesDepartmentName(studentDepartment: string | null | undefined, departmentName: string | null | undefined) {
  if (!studentDepartment || !departmentName) return false;

  return studentDepartment.trim().toLowerCase() === departmentName.trim().toLowerCase();
}
